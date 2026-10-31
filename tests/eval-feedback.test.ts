import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { build } from "../evals/feedback/dsl";
import {
  RESULTS_DIR,
  heuristicGrader,
  labelsHash,
  missingRecordings,
  replayGrader,
  runEval,
  type EvalResult,
  type Recording,
} from "../evals/feedback/harness";
import { LABEL_STATUS, SCENARIOS } from "../evals/feedback/scenarios";
import { expectedPoints, predictedPoints, scoreSession, summarize } from "../evals/feedback/score";
import { RUBRIC, type FeedbackReport } from "@/lib/feedback/analyze";
import type { ClaudeGrade } from "@/lib/feedback/claude";
import { eventSchema } from "@/lib/interview/types";

describe("feedback eval set", () => {
  it("has 20–30 scenarios with unique ids and draft labels awaiting review", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(20);
    expect(SCENARIOS.length).toBeLessThanOrEqual(30);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
    expect(LABEL_STATUS).toMatch(/needs human review/);
    for (const s of SCENARIOS) {
      expect(s.reviewed).toBe(false);
      expect(expectedPoints(s).length).toBeGreaterThan(0);
      expect(s.hire.length).toBeGreaterThan(0);
    }
  });

  it("covers both strengths and weaknesses in every rubric area", () => {
    const points = SCENARIOS.flatMap(expectedPoints).map((p) => `${p.area}:${p.polarity}`);
    for (const area of RUBRIC) {
      expect(points).toContain(`${area}:strength`);
      expect(points).toContain(`${area}:weakness`);
    }
  });

  it("builds valid, time-ordered timelines that end on time", () => {
    for (const s of SCENARIOS) {
      const b = build(s);
      for (const e of b.events) expect(() => eventSchema.parse(e)).not.toThrow();
      const ts = b.events.map((e) => e.t);
      expect(ts).toEqual([...ts].sort((x, y) => x - y));
      expect(Math.max(...ts)).toBe(b.durationMs);
    }
  });
});

describe("scoring", () => {
  const s = SCENARIOS.find((x) => x.id === "05-wrong-complexity-claim")!;
  const report = (scores: Record<string, number>, focus: string[] = []): FeedbackReport =>
    ({
      rubric: Object.fromEntries(RUBRIC.map((k) => [k, { score: scores[k] ?? 3, evidence: "" }])),
      focus: focus.map((area) => ({ area, title: "", why: "", drill: "" })),
      hire: { signal: "hire", reasons: [], bar: "" },
    }) as unknown as FeedbackReport;

  it("reads weaknesses from low scores and focus areas, strengths from 4s", () => {
    const pts = predictedPoints(report({ approach: 4, correctness: 4, complexity: 2, testing: 3 }, ["testing"]));
    expect(pts).toEqual([
      { area: "approach", polarity: "strength" },
      { area: "correctness", polarity: "strength" },
      { area: "testing", polarity: "weakness" },
      { area: "complexity", polarity: "weakness" },
    ]);
  });

  it("counts matches, extra points and missed points", () => {
    const sc = scoreSession(s, report({ approach: 4, correctness: 4, testing: 1 }));
    expect(sc.truePositives).toEqual(["approach:strength", "correctness:strength"]);
    expect(sc.falsePositives).toEqual(["testing:weakness"]);
    expect(sc.falseNegatives).toEqual(["complexity:weakness"]);
    expect(sc.hireAgrees).toBe(true);
    const sum = summarize([sc]);
    expect(sum.overall).toMatchObject({ truePositives: 2, falsePositives: 1, falseNegatives: 1, precision: 0.667, recall: 0.667 });
    expect(sum.byArea.complexity.recall).toBe(0);
  });
});

/** A fake Claude grade that says exactly what the labels say, as a replayed recording. */
function oracleGrade(id: string): ClaudeGrade {
  const s = SCENARIOS.find((x) => x.id === id)!;
  const rubric = Object.fromEntries(
    RUBRIC.map((k) => {
      const l = s.labels[k];
      return [k, { score: l ? (l[0] === "strength" ? 4 : 2) : 3, evidence: l?.[1] ?? "Met the bar." }];
    }),
  ) as ClaudeGrade["rubric"];
  const weak = RUBRIC.filter((k) => s.labels[k]?.[0] === "weakness");
  return {
    summary: "Oracle.",
    rubric,
    hire: { signal: s.hire[0], reasons: ["Oracle."] },
    focus: weak.slice(0, 3).map((area) => ({ area, title: area, why: "Oracle.", drill: "Oracle." })),
    moments: [],
  };
}

describe("harness", () => {
  it("replays recorded Claude grades through the app's merge step", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "eval-rec-"));
    expect(missingRecordings(dir)).toHaveLength(SCENARIOS.length);
    for (const s of SCENARIOS) {
      const rec: Recording = { scenarioId: s.id, model: "oracle", recordedAt: "2026-10-31T00:00:00Z", grade: oracleGrade(s.id) };
      writeFileSync(path.join(dir, `${s.id}.json`), JSON.stringify(rec));
    }
    expect(missingRecordings(dir)).toEqual([]);
    const r = await runEval("claude-replay", replayGrader(dir), { model: "oracle" });
    // A grader that agrees with every label scores perfectly.
    expect(r.summary.overall.precision).toBe(1);
    expect(r.summary.overall.recall).toBe(1);
    expect(r.summary.hireAgreement).toBeGreaterThan(0.9);
  });

  it("rejects a malformed recording instead of scoring it", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "eval-bad-"));
    const s = SCENARIOS[0];
    writeFileSync(path.join(dir, `${s.id}.json`), JSON.stringify({ scenarioId: s.id, grade: { summary: "x" } }));
    await expect(runEval("claude-replay", replayGrader(dir), { scenarios: [s] })).rejects.toThrow();
  });

  it("the stored heuristic results match the current labels and grader", async () => {
    const stored = JSON.parse(readFileSync(path.join(RESULTS_DIR, "heuristic.json"), "utf8")) as EvalResult;
    expect(stored.labelsHash).toBe(labelsHash());
    const fresh = await runEval("heuristic", heuristicGrader);
    expect(stored.summary).toEqual(fresh.summary);
  });
});
