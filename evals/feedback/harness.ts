// The feedback-quality eval harness: builds every scenario's timeline, runs a
// grader on it, and scores the reports against the draft labels.
//
// Graders:
// - heuristic: the rule-based report (feedback/analyze.ts). Runs offline.
// - replay: Claude's grade read from recorded responses in a folder, merged
//   by the same code the app uses (mergeGrade). Runs offline, costs nothing.
// - record: calls Claude once per scenario and saves the responses for
//   replay. Needs ANTHROPIC_API_KEY and spends money; never runs in tests.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COMPANY_BY_ID } from "../../src/lib/engine/companies";
import { analyzeSession, type FeedbackReport } from "../../src/lib/feedback/analyze";
import { FEEDBACK_MODEL, mergeGrade, parseGrade, requestGrade, type ClaudeGrade } from "../../src/lib/feedback/claude";
import { build, type BuiltSession, type Scenario } from "./dsl";
import { LABEL_STATUS, SCENARIOS } from "./scenarios";
import { scoreSession, summarize, type SessionScore, type Summary } from "./score";

export type Grader = (s: BuiltSession, heuristic: FeedbackReport) => Promise<FeedbackReport> | FeedbackReport;

export interface Recording {
  scenarioId: string;
  model: string;
  recordedAt: string;
  usage?: { input_tokens: number; output_tokens: number };
  grade: ClaudeGrade;
}

export interface EvalResult {
  grader: string;
  model: string | null;
  ranAt: string;
  labelStatus: string;
  /** Fingerprint of the scenarios and labels, so results can be matched to a label version. */
  labelsHash: string;
  reviewedSessions: number;
  summary: Summary;
  sessions: SessionScore[];
}

const companyName = (s: Scenario) => (s.company ? (COMPANY_BY_ID[s.company]?.name ?? null) : null);

export function heuristicReport(b: BuiltSession): FeedbackReport {
  const s = b.scenario;
  return analyzeSession({ events: b.events, problem: b.problem, durationMs: b.durationMs, company: s.company, level: s.level }, companyName(s));
}

export function labelsHash(scenarios: Scenario[] = SCENARIOS): string {
  return createHash("sha256").update(JSON.stringify(scenarios)).digest("hex").slice(0, 12);
}

export async function runEval(
  name: string,
  grader: Grader,
  opts: { model?: string | null; scenarios?: Scenario[] } = {},
): Promise<EvalResult> {
  const scenarios = opts.scenarios ?? SCENARIOS;
  const sessions: SessionScore[] = [];
  for (const s of scenarios) {
    const built = build(s);
    const report = await grader(built, heuristicReport(built));
    sessions.push(scoreSession(s, report));
  }
  return {
    grader: name,
    model: opts.model ?? null,
    ranAt: new Date().toISOString(),
    labelStatus: LABEL_STATUS,
    labelsHash: labelsHash(scenarios),
    reviewedSessions: scenarios.filter((s) => s.reviewed).length,
    summary: summarize(sessions),
    sessions,
  };
}

export const heuristicGrader: Grader = (_b, heuristic) => heuristic;

/** Which scenarios have no recording in `dir`. */
export function missingRecordings(dir: string, scenarios: Scenario[] = SCENARIOS): string[] {
  return scenarios.filter((s) => !existsSync(path.join(dir, `${s.id}.json`))).map((s) => s.id);
}

/** Replays recorded Claude grades through the app's own merge step. */
export function replayGrader(dir: string): Grader {
  return (b, heuristic) => {
    const rec = JSON.parse(readFileSync(path.join(dir, `${b.scenario.id}.json`), "utf8")) as Recording;
    return mergeGrade(heuristic, parseGrade(rec.grade));
  };
}

/** Calls Claude for each scenario and saves the grade. Costs money: only run on purpose. */
export async function recordLive(dir: string, scenarios: Scenario[] = SCENARIOS): Promise<Recording[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set; nothing to record.");
  mkdirSync(dir, { recursive: true });
  const out: Recording[] = [];
  for (const s of scenarios) {
    const file = path.join(dir, `${s.id}.json`);
    if (existsSync(file)) continue;
    const b = build(s);
    const { grade, usage } = await requestGrade(b.events, b.problem, heuristicReport(b), {
      level: s.level,
      companyName: companyName(s),
      minutes: Math.max(15, Math.ceil(s.endMin / 15) * 15),
    });
    const rec: Recording = { scenarioId: s.id, model: FEEDBACK_MODEL, recordedAt: new Date().toISOString(), usage, grade };
    writeFileSync(file, JSON.stringify(rec, null, 2) + "\n");
    out.push(rec);
    console.log(`recorded ${s.id} (${usage.input_tokens} in, ${usage.output_tokens} out)`);
  }
  return out;
}

export const EVAL_DIR = path.join(process.cwd(), "evals", "feedback");
export const recordingsDir = (model: string) => path.join(EVAL_DIR, "recordings", model);
export const RESULTS_DIR = path.join(EVAL_DIR, "results");
