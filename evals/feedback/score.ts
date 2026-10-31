// Scoring a grader's feedback against the labeled "correct feedback" points.
//
// A feedback point is (rubric area, strength or weakness). From a report:
// - a weakness is any area scored 1–2, or listed in the top focus areas
//   (that's what the candidate is told to work on);
// - a strength is any area scored 4 that isn't a focus area.
// Precision: of the points the grader made, how many a human would also make.
// Recall: of the points a human would make, how many the grader made.
// Pure functions, so the same scoring runs on any grader's reports.
import { HIRE_SIGNALS, RUBRIC, type FeedbackReport, type HireSignal, type RubricKey } from "../../src/lib/feedback/analyze";
import type { Polarity, Scenario } from "./dsl";

export interface Point {
  area: RubricKey;
  polarity: Polarity;
}

const key = (p: Point) => `${p.area}:${p.polarity}`;

export function expectedPoints(s: Scenario): Point[] {
  return RUBRIC.flatMap((area) => {
    const l = s.labels[area];
    return l ? [{ area, polarity: l[0] }] : [];
  });
}

export function predictedPoints(r: FeedbackReport): Point[] {
  const focus = new Set(r.focus.map((f) => f.area));
  return RUBRIC.flatMap((area): Point[] => {
    const score = r.rubric[area].score;
    if (score <= 2 || focus.has(area)) return [{ area, polarity: "weakness" }];
    if (score >= 4) return [{ area, polarity: "strength" }];
    return [];
  });
}

export interface SessionScore {
  id: string;
  expected: string[];
  predicted: string[];
  truePositives: string[];
  falsePositives: string[];
  falseNegatives: string[];
  hire: HireSignal;
  hireAccepted: HireSignal[];
  /** The grader's signal is one a calibrated interviewer could give. */
  hireAgrees: boolean;
  /** Steps between the grader's signal and the nearest accepted one. */
  hireDistance: number;
}

export function scoreSession(s: Scenario, r: FeedbackReport): SessionScore {
  const expected = expectedPoints(s).map(key);
  const predicted = predictedPoints(r).map(key);
  const exp = new Set(expected);
  const pred = new Set(predicted);
  const idx = HIRE_SIGNALS.indexOf(r.hire.signal);
  const hireDistance = Math.min(...s.hire.map((h) => Math.abs(HIRE_SIGNALS.indexOf(h) - idx)));
  return {
    id: s.id,
    expected,
    predicted,
    truePositives: predicted.filter((p) => exp.has(p)),
    falsePositives: predicted.filter((p) => !exp.has(p)),
    falseNegatives: expected.filter((p) => !pred.has(p)),
    hire: r.hire.signal,
    hireAccepted: s.hire,
    hireAgrees: hireDistance === 0,
    hireDistance,
  };
}

export interface Metrics {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
}

function metrics(tp: number, fp: number, fn: number): Metrics {
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = precision !== null && recall !== null && precision + recall ? (2 * precision * recall) / (precision + recall) : null;
  const r = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 1000);
  return { truePositives: tp, falsePositives: fp, falseNegatives: fn, precision: r(precision), recall: r(recall), f1: r(f1) };
}

export interface Summary {
  sessions: number;
  /** Micro-averaged over every point in every session. */
  overall: Metrics;
  byPolarity: Record<Polarity, Metrics>;
  byArea: Record<RubricKey, Metrics>;
  hireAgreement: number;
  hireWithinOne: number;
}

export function summarize(scores: SessionScore[]): Summary {
  const count = (filter: (k: string) => boolean) => {
    const tp = scores.reduce((n, s) => n + s.truePositives.filter(filter).length, 0);
    const fp = scores.reduce((n, s) => n + s.falsePositives.filter(filter).length, 0);
    const fn = scores.reduce((n, s) => n + s.falseNegatives.filter(filter).length, 0);
    return metrics(tp, fp, fn);
  };
  const share = (f: (s: SessionScore) => boolean) => (scores.length ? Math.round((scores.filter(f).length / scores.length) * 1000) / 1000 : 0);
  return {
    sessions: scores.length,
    overall: count(() => true),
    byPolarity: {
      strength: count((k) => k.endsWith(":strength")),
      weakness: count((k) => k.endsWith(":weakness")),
    },
    byArea: Object.fromEntries(RUBRIC.map((a) => [a, count((k) => k.startsWith(`${a}:`))])) as Record<RubricKey, Metrics>,
    hireAgreement: share((s) => s.hireAgrees),
    hireWithinOne: share((s) => s.hireDistance <= 1),
  };
}
