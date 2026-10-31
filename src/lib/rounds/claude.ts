import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { fmtClock } from "../interview/timeline";
import { focusFrom, roundBarShift, roundHireSignal, weighted } from "./analyze";
import type { GradeContext, RoundKindDef } from "./kind";
import type { RoundReport, Turn, TurnInput } from "./types";

// Claude for conversation rounds: the interviewer's per-turn message (the
// stream itself reuses the mock interviewer's claudeTurn), and the grader,
// which rewrites the rubric from the transcript and artifact while keeping the
// rule-based checks.

export const ROUND_GRADER_MODEL = process.env.FEEDBACK_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const EVENT_TEXT: Record<Exclude<TurnInput["kind"], "say">, string> = {
  start: "The candidate just joined. Open the round.",
  silence: "The candidate has been quiet for a while.",
  wrap: "A few minutes are left. Start wrapping up.",
};

/** The per-turn message: what happened, the clock, and the artifact as it is now. */
export function roundTurnMessage(input: TurnInput, ctx: { elapsedMs: number; remainingMs: number; artifact: string; artifactLabel: string }): string {
  const head = input.kind === "say" ? `Candidate said: "${input.text}"` : `[Event] ${EVENT_TEXT[input.kind]}`;
  return `${head}

[Round state at ${fmtClock(ctx.elapsedMs)}, ${fmtClock(Math.max(0, ctx.remainingMs))} left.]
[${ctx.artifactLabel}:]
${ctx.artifact || "(empty)"}`;
}

const transcriptBlock = (turns: Turn[]) =>
  turns.map((t) => `[${fmtClock(t.t)}] ${t.speaker === "candidate" ? "Candidate" : "Interviewer"}: ${t.text}${t.interrupted ? " (cut off)" : ""}`).join("\n");

/** Rewrites the rubric, summary and focus areas with Claude; checks and extras stay rule-based. */
export async function claudeRoundReport<A>(def: RoundKindDef<A>, ctx: GradeContext<A>, base: RoundReport): Promise<RoundReport> {
  const keys = [...def.rubric] as [string, ...string[]];
  const schema = z.object({
    rubric: z.array(
      z.object({
        key: z.enum(keys),
        score: z.number().int().describe("1 (missing or wrong) to 4 (strong, at the bar for the level)"),
        evidence: z.string().describe("One or two sentences to the candidate as 'you', citing what they said or drew"),
      }),
    ),
    summary: z.string().describe("Two sentences on the round, to the candidate as 'you'"),
    strengths: z.array(z.string()).describe("Up to three specific strengths"),
    focus: z
      .array(z.object({ area: z.enum(keys), title: z.string(), why: z.string(), drill: z.string().describe("A concrete practice drill") }))
      .describe("The top three things to work on, most important first"),
    reasons: z.array(z.string()).describe("Two to four reasons behind the overall signal"),
  });
  const res = await getClient().beta.messages.parse({
    model: ROUND_GRADER_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    system: `You grade a practice ${def.kind === "design" ? "system design" : def.kind === "behavioral" ? "behavioral" : "code walkthrough"} interview for a ${ctx.config.level} candidate${ctx.companyName ? ` targeting ${ctx.companyName}` : ""}. Be calibrated like a real interviewer: a 4 means at the bar for this level, not perfect. Ground every score in what the candidate actually said or produced. The transcript comes from speech recognition, so ignore transcription errors.`,
    messages: [
      {
        role: "user",
        content: `# Rubric
${def.rubric.map((k) => `- ${k}: ${def.rubricInfo[k].label}. ${def.rubricInfo[k].help}`).join("\n")}

# Reference for this topic
${def.graderBrief(ctx.topicId)}

# Transcript (${fmtClock(ctx.durationMs)})
${transcriptBlock(ctx.transcript) || "(nothing said)"}

# What the candidate produced
${def.describeArtifact(ctx.topicId, ctx.artifact) || "(nothing)"}

# Rule-based checks (measured; keep consistent with them)
${base.checks.map((c) => `- ${c.ok ? "yes" : "no"}: ${c.label}${c.detail ? ` (${c.detail})` : ""}`).join("\n")}`,
      },
    ],
  });
  const g = res.parsed_output;
  if (!g) throw new Error("The grader returned nothing");
  const rubric = { ...base.rubric };
  for (const r of g.rubric) if (rubric[r.key]) rubric[r.key] = { score: Math.min(4, Math.max(1, r.score)), evidence: r.evidence };
  const overall = weighted(rubric, def.weights);
  const signal = roundHireSignal(overall, roundBarShift(ctx.config.company, ctx.config.level));
  const focus = g.focus.length ? g.focus.slice(0, 3) : focusFrom(rubric, def.weights, {});
  return {
    ...base,
    generator: "claude",
    summary: g.summary,
    rubric,
    overall,
    hire: { signal, reasons: g.reasons.length ? g.reasons : base.hire.reasons },
    strengths: g.strengths.slice(0, 3),
    focus: focus.length ? focus : base.focus,
  };
}
