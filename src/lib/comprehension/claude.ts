import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { HIRE_SIGNALS } from "../feedback/analyze";
import { debugHireSignal, weightedDebugOverall, type DebugGradeInput, type DebugReport } from "./grade";
import type { DebugTask } from "./types";

// Claude for debugging rounds: the optional assistant (Google's pilot lets
// candidates use one), and a grader that re-scores the written parts. Bugs
// fixed and test results always come from the tests, never from the model.

export const DEBUG_ASSISTANT_MODEL = process.env.DEBUG_ASSISTANT_MODEL || "claude-sonnet-5-5";
export const DEBUG_GRADER_MODEL = process.env.FEEDBACK_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const repoBlock = (files: Record<string, string>) =>
  Object.entries(files)
    .map(([path, src]) => `--- ${path} ---\n${src.slice(0, 20_000)}`)
    .join("\n\n");

export async function claudeHelperReply(task: DebugTask, history: { role: "user" | "assistant"; text: string }[], prompt: string, files: Record<string, string>) {
  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-12).map((m) => ({ role: m.role, content: m.text }));
  messages.push({ role: "user", content: `The repo right now:\n\n${repoBlock(files)}\n\n---\n\n${prompt}` });
  const res = await getClient().beta.messages.create({
    model: DEBUG_ASSISTANT_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: `You are the AI assistant in a practice "code comprehension and debugging" interview round, like Google's AI-assisted pilot. The candidate is reading an unfamiliar JavaScript repo with a few seeded bugs. Their brief:

${task.brief}

Help the way a good pair programmer would: explain what code does, help reason about a failing test, suggest what to check next. Don't list or fix the bugs for them, even if asked directly; the round measures whether they can find them. Keep answers short, in plain Markdown with \`\`\`js fences for code.`,
    messages,
  });
  if (res.stop_reason === "refusal") throw new Error("The assistant declined to answer");
  return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
}

const gradeSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      score: z.number().int().describe("1 (wrong or empty) to 4 (complete and precise)"),
      note: z.string().describe("One sentence, to the candidate: what the answer got right or missed"),
    }),
  ),
  writeup: z.object({
    score: z.number().int().describe("1 to 4: did they explain each bug's symptom, root cause, fix and how they verified it"),
    evidence: z.string().describe("One or two sentences, to the candidate"),
  }),
  explained: z.array(z.string()).describe("Ids of the seeded bugs whose root cause the write-up explains correctly"),
  summary: z.string().describe("One or two sentences on the round, to the candidate as 'you'"),
});

/** Re-scores the written answers and write-up with Claude, keeping test-based results as they are. */
export async function claudeDebugReport(input: DebugGradeInput, base: DebugReport): Promise<DebugReport> {
  const { task } = input;
  const res = await getClient().beta.messages.parse({
    model: DEBUG_GRADER_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(gradeSchema) },
    system:
      "You grade the written part of a code comprehension and debugging interview against the reference answers. Be calibrated: an answer that names the right steps but gets one wrong is a 2 or 3, not a 4. Credit correct ideas in other words.",
    messages: [
      {
        role: "user",
        content: `# Questions and the candidate's answers
${task.questions.map((q) => `## ${q.id}: ${q.prompt}\nReference: ${q.answer}\nCandidate: ${input.answers[q.id]?.trim() || "(no answer)"}`).join("\n\n")}

# Seeded bugs
${task.bugs.map((b) => `- ${b.id} (${b.file}): ${b.description} Fixed in the final code: ${base.bugs.find((x) => x.id === b.id)?.fixed ? "yes" : "no"}.`).join("\n")}

# The candidate's write-up of the bugs
${input.notes.trim() || "(empty)"}`,
      },
    ],
  });
  const g = res.parsed_output;
  if (!g) throw new Error("The grader returned nothing");
  const byId = new Map(g.questions.map((q) => [q.id, q]));
  const questions = base.questions.map((q) => {
    const c = byId.get(q.id);
    return c && q.yours ? { ...q, score: Math.min(4, Math.max(1, c.score)), note: c.note } : q;
  });
  const explained = new Set(g.explained);
  const bugs = base.bugs.map((b) => ({ ...b, explained: explained.has(b.id) }));
  const rubric = {
    ...base.rubric,
    comprehension: { score: Math.round(questions.reduce((s, q) => s + q.score, 0) / Math.max(1, questions.length)), evidence: base.rubric.comprehension.evidence },
    writeup: input.notes.trim() ? { score: Math.min(4, Math.max(1, g.writeup.score)), evidence: g.writeup.evidence } : base.rubric.writeup,
  };
  const overall = weightedDebugOverall(rubric);
  const fixed = bugs.filter((b) => b.fixed).length;
  const signal = debugHireSignal(overall, fixed, bugs.length);
  return {
    ...base,
    generator: "claude",
    summary: g.summary,
    rubric,
    overall,
    hire: { signal: HIRE_SIGNALS.includes(signal) ? signal : base.hire.signal, reasons: base.hire.reasons },
    bugs,
    questions,
  };
}
