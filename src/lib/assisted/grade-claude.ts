import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { FEEDBACK_MODEL } from "../feedback/claude";
import { HIRE_SIGNALS } from "../feedback/analyze";
import { fmtClock } from "../interview/timeline";
import { ASSISTED_INFO, ASSISTED_RUBRIC, assistedSignal, weightedOverall, type AssistedKey, type AssistedReport, type GradeInput } from "./grade";

// Claude grading for AI-assisted rounds, used when ANTHROPIC_API_KEY is set.
// Bug outcomes, test results and the AI share stay rule-based; Claude
// rewrites the rubric, hire signal and focus areas from the full record.

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const scoreSchema = z.object({
  score: z.number().int().describe("1 = well below the bar, 2 = below, 3 = meets, 4 = strong"),
  evidence: z.string().describe("One or two sentences citing prompts or code, with timestamps (m:ss)"),
});

const schema = z.object({
  summary: z.string().describe("One or two sentences to the candidate, as 'you'"),
  rubric: z.object(Object.fromEntries(ASSISTED_RUBRIC.map((k) => [k, scoreSchema])) as Record<AssistedKey, typeof scoreSchema>),
  hire: z.object({ signal: z.enum(HIRE_SIGNALS), reasons: z.array(z.string()) }),
  focus: z.array(z.object({ area: z.enum(ASSISTED_RUBRIC), title: z.string(), why: z.string(), drill: z.string() })).describe("Top three, most important first"),
});

const SYSTEM = `You grade AI-assisted coding interview rounds (like Meta's AI-enabled round): the candidate works in a small repo with an AI assistant and must paste its code themselves. Some assistant answers had a deliberately planted bug, to test whether the candidate reviews AI output.

Score 1 to 4 on:
${ASSISTED_RUBRIC.map((k) => `- ${k}: ${ASSISTED_INFO[k].label}. ${ASSISTED_INFO[k].help}`).join("\n")}

Be specific and honest, cite timestamps, and don't inflate. Failing tests cap the hire signal at lean-hire, or "no" below half passing. Write to the candidate as "you".`;

export async function claudeAssistedReport(input: GradeInput, heuristic: AssistedReport): Promise<AssistedReport> {
  const chat = input.events.flatMap((e) =>
    e.type === "prompt"
      ? [`[${fmtClock(e.t)}] Candidate (to ${e.payload.model}): ${e.payload.text}`]
      : e.type === "reply"
        ? [`[${fmtClock(e.t)}] Assistant${e.payload.planted ? ` [PLANTED BUG: ${e.payload.planted.description}]` : ""}: ${e.payload.text.slice(0, 4000)}`]
        : e.type === "run"
          ? [`[${fmtClock(e.t)}] Ran tests: ${e.payload.passed}/${e.payload.total}`]
          : e.type === "paste"
            ? [`[${fmtClock(e.t)}] Pasted ${e.payload.chars} chars into ${e.payload.path}${e.payload.fromAssistant ? " (from an assistant answer)" : ""}`]
            : [],
  );
  const changed = Object.entries(input.finalFiles)
    .filter(([p, s]) => input.task.files[p] !== s)
    .map(([p, s]) => `--- ${p} (final) ---\n${s.slice(0, 8000)}`);

  const content = `# Task: ${input.task.title}
${input.task.brief}

# Chat, runs and pastes
${chat.join("\n") || "(the assistant wasn't used)"}

# Changed files
${changed.join("\n\n") || "(no changes)"}

# Final tests (visible and hidden)
${input.tests.passed}/${input.tests.total} passing${input.tests.failing.length ? `; failing: ${input.tests.failing.join("; ")}` : ""}

# Planted bug outcomes
${heuristic.bugs.map((b) => `${b.outcome}: ${b.description} (${b.how})`).join("\n") || "(none planted)"}

# Share of new lines copied from the assistant
${heuristic.aiShare === null ? "n/a" : `${Math.round(heuristic.aiShare * 100)}%`}

# The candidate's explanation
${input.explanation || "(none)"}

# A rule-based first pass, for reference
${ASSISTED_RUBRIC.map((k) => `${k}: ${heuristic.rubric[k].score} (${heuristic.rubric[k].evidence})`).join("\n")}`;

  const res = await getClient().beta.messages.parse({
    model: FEEDBACK_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(schema) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("The grading model declined this round");
  const g = res.parsed_output;
  if (!g) throw new Error("The grading model returned no report");
  const rubric = Object.fromEntries(
    ASSISTED_RUBRIC.map((k) => [k, { score: Math.min(4, Math.max(1, Math.round(g.rubric[k].score))), evidence: g.rubric[k].evidence }]),
  ) as AssistedReport["rubric"];
  const cap = assistedSignal(4, input.tests);
  const signal = HIRE_SIGNALS.indexOf(g.hire.signal) > HIRE_SIGNALS.indexOf(cap) ? cap : g.hire.signal;
  return {
    ...heuristic,
    generator: "claude",
    summary: g.summary,
    rubric,
    overall: weightedOverall(rubric),
    hire: { signal, reasons: g.hire.reasons.slice(0, 4) },
    focus: g.focus.slice(0, 3),
  };
}
