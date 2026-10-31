import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { codeAt, fmtClock, transcript } from "../interview/timeline";
import type { SessionEvent } from "../interview/types";
import type { Problem } from "../problems/types";
import {
  HIRE_SIGNALS,
  RUBRIC,
  RUBRIC_INFO,
  hireSignal,
  weightedOverall,
  type FeedbackReport,
  type RubricKey,
} from "./analyze";

// Claude grading for the feedback report, used when ANTHROPIC_API_KEY is set.
// The spec picks Opus for this: one call per session where latency doesn't
// matter, over a long code timeline plus transcript. The heuristic report is
// passed in as evidence and stays the fallback if this call fails.

export const FEEDBACK_MODEL = process.env.FEEDBACK_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const scoreSchema = z.object({
  score: z.number().int().describe("1 = well below the bar, 2 = below, 3 = meets, 4 = strong"),
  evidence: z.string().describe("One or two sentences citing what the candidate said or did, with timestamps (m:ss)"),
});

const gradeSchema = z.object({
  summary: z.string().describe("One or two sentences: the overall picture, addressed to the candidate as 'you'"),
  rubric: z.object(Object.fromEntries(RUBRIC.map((k) => [k, scoreSchema])) as Record<RubricKey, typeof scoreSchema>),
  hire: z.object({
    signal: z.enum(HIRE_SIGNALS),
    reasons: z.array(z.string()).describe("Two to four short reasons a debrief would give"),
  }),
  focus: z
    .array(
      z.object({
        area: z.enum(RUBRIC),
        title: z.string().describe("A few words"),
        why: z.string().describe("What happened in this interview, with a timestamp"),
        drill: z.string().describe("A concrete exercise for the next week"),
      }),
    )
    .describe("The top three things to work on, most important first"),
  moments: z
    .array(z.object({ t: z.number().int().describe("Milliseconds since the start"), tone: z.enum(["good", "warn", "info"]), text: z.string() }))
    .describe("Up to six notable moments worth replaying, beyond the ones already listed"),
});

const SYSTEM = `You are a senior software engineer writing the debrief for a mock coding interview, the way a calibrated interviewer at a top company would. You get the problem, the full transcript with timestamps, every test run, the code at key moments, and numbers computed from the recording.

Score each rubric dimension from 1 to 4 against the hire bar for the stated level and company:
${RUBRIC.map((k) => `- ${k}: ${RUBRIC_INFO[k].label}. ${RUBRIC_INFO[k].help}`).join("\n")}

Be specific and honest: cite timestamps and quote the candidate where it helps. Don't inflate scores; a borderline performance is a "no" in today's market. An unsolved problem caps the hire signal at lean-hire, or "no" if fewer than half the tests passed. Speech-to-text drops filler words and mangles code terms, so judge communication by substance (did they explain, narrate, respond to hints) more than by exact wording. Write focus areas and drills for the candidate, as "you".`;

function digest(events: SessionEvent[], problem: Problem, report: FeedbackReport, ctx: { level: string; companyName: string | null; minutes: number }): string {
  const lines = transcript(events).map((l) => `[${fmtClock(l.t)}] ${l.speaker === "candidate" ? "Candidate" : "Interviewer"}: ${l.text}`);
  const runs = events.flatMap((e) =>
    e.type === "run"
      ? [`[${fmtClock(e.t)}] ${e.payload.scope === "all" ? "Submit" : "Run samples"}: ${e.payload.verdict}, ${e.payload.passed}/${e.payload.total}${e.payload.failingLabels.length ? `, failing: ${e.payload.failingLabels.join(", ")}` : ""}`]
      : [],
  );
  const runTimes = events.filter((e) => e.type === "run").map((e) => e.t);
  const keyTimes = [...new Set([...runTimes.slice(0, 3), ...runTimes.slice(-2)])];
  const snapshots = keyTimes.map((t) => `--- Code at ${fmtClock(t)} ---\n${codeAt(events, t).code.slice(0, 6000)}`);
  const finalCode = codeAt(events).code.slice(0, 8000);
  const { silentStretches, ...metrics } = report.communication;

  return `Level: ${ctx.level}. Company style: ${ctx.companyName ?? "generic"}. Length: ${ctx.minutes} minutes; it ran ${fmtClock(report.outcome.durationMs)}.

# Problem: ${problem.title} (${problem.difficulty})
${problem.statement}
Optimal complexity: time ${problem.complexity.time}, space ${problem.complexity.space}.

# Transcript
${lines.join("\n") || "(nothing was said)"}

# Test runs
${runs.join("\n") || "(no runs)"}

${snapshots.join("\n\n")}

--- Final code ---
${finalCode || "(empty)"}

# Measured from the recording
${JSON.stringify(metrics)}
Silent stretches over 45s: ${silentStretches.map((s) => `${fmtClock(s.fromMs)} for ${fmtClock(s.ms)}${s.coding ? " (coding)" : ""}${s.afterFailedRun ? " (after a failed run)" : ""}`).join("; ") || "none"}

# Moments already annotated
${report.moments.map((m) => `[${fmtClock(m.t)}] ${m.text}`).join("\n") || "(none)"}

# A rule-based first pass, for reference (override it where the transcript shows otherwise)
${RUBRIC.map((k) => `${k}: ${report.rubric[k].score} (${report.rubric[k].evidence})`).join("\n")}`;
}

export type ClaudeGrade = z.infer<typeof gradeSchema>;

/** Checks a stored grade (the eval's recorded responses) against the schema. */
export const parseGrade = (value: unknown): ClaudeGrade => gradeSchema.parse(value);

export type GradeContext = { level: string; companyName: string | null; minutes: number };

/** One grading call to Claude; returns its structured grade. */
export async function requestGrade(
  events: SessionEvent[],
  problem: Problem,
  heuristic: FeedbackReport,
  ctx: GradeContext,
): Promise<{ grade: ClaudeGrade; usage: { input_tokens: number; output_tokens: number } }> {
  const res = await getClient().beta.messages.parse({
    model: FEEDBACK_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(gradeSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: digest(events, problem, heuristic, ctx) }],
  });
  if (res.stop_reason === "refusal") throw new Error("The grading model declined this session");
  const g = res.parsed_output;
  if (!g) throw new Error("The grading model returned no report");
  return { grade: g, usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens } };
}

/** Merges Claude's grade over the heuristic report, keeping the measured numbers. Pure. */
export function mergeGrade(heuristic: FeedbackReport, g: ClaudeGrade): FeedbackReport {
  const rubric = Object.fromEntries(
    RUBRIC.map((k) => [k, { score: Math.min(4, Math.max(1, Math.round(g.rubric[k].score))), evidence: g.rubric[k].evidence }]),
  ) as FeedbackReport["rubric"];
  const overall = weightedOverall(rubric);
  // Claude's signal, but never above what the outcome allows.
  const capped = hireSignal(4, heuristic.outcome, 0);
  const signal = HIRE_SIGNALS.indexOf(g.hire.signal) > HIRE_SIGNALS.indexOf(capped) ? capped : g.hire.signal;
  const known = new Set(heuristic.moments.map((m) => Math.round(m.t / 5000)));
  const extra = g.moments
    .filter((m) => m.t >= 0 && m.t <= heuristic.outcome.durationMs && !known.has(Math.round(m.t / 5000)))
    .slice(0, 6);

  return {
    ...heuristic,
    generator: "claude",
    summary: g.summary,
    rubric,
    overall,
    hire: { signal, reasons: g.hire.reasons.slice(0, 4), bar: heuristic.hire.bar },
    focus: g.focus.slice(0, 3),
    moments: [...heuristic.moments, ...extra].sort((a, b) => a.t - b.t),
  };
}

/** Grades the session with Claude and merges the result over the heuristic report. */
export async function claudeReport(
  events: SessionEvent[],
  problem: Problem,
  heuristic: FeedbackReport,
  ctx: GradeContext,
): Promise<FeedbackReport> {
  const { grade } = await requestGrade(events, problem, heuristic, ctx);
  return mergeGrade(heuristic, grade);
}
