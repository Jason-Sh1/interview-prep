// Rule-based grading for behavioral rounds: finds each question in the
// transcript, runs the STAR checks on everything said in answer (follow-ups
// included), and scores the usual behavioral rubric. Claude refines the
// wording and judgement when a key is set (rounds/claude.ts), keeping these checks.
import { candidateTurns, clampScore, focusFrom, roundBarShift, roundHireSignal, scoreFromFraction, strengthsFrom, talkMetrics, weighted } from "../rounds/analyze";
import type { GradeContext } from "../rounds/kind";
import type { RoundCheck, RoundMoment, RoundReport, RoundScore, Turn } from "../rounds/types";
import type { BehavioralArtifact } from "./artifact";
import { competencyLabel } from "./competencies";
import { principlesFor, principlesShown } from "./principles";
import { BEHAVIORAL_TOPIC_BY_ID, QUESTION_BY_ID, type BehavioralQuestion } from "./questions";
import { PROBES, YOUR_QUESTIONS, questionsOf } from "./scripted";
import { analyzeAnswer, GAP_TEXT, LONG_WORDS, SHORT_WORDS, type StarAnalysis, type StarGap } from "./star";

export const BEHAVIORAL_RUBRIC = ["structure", "specificity", "ownership", "impact", "reflection", "relevance", "communication"] as const;
export type BehavioralRubricKey = (typeof BEHAVIORAL_RUBRIC)[number];

export const BEHAVIORAL_INFO: Record<BehavioralRubricKey, { label: string; help: string }> = {
  structure: { label: "Structure (STAR)", help: "Each answer set up the situation and task, walked through actions, and landed on a result." },
  specificity: { label: "Specificity", help: "Real, concrete examples with details and numbers, not hypotheticals or generalities." },
  ownership: { label: "Ownership", help: "Clear about what you personally did and decided, not just what the team did." },
  impact: { label: "Impact", help: "Results were stated and measured, and mattered to the team, product or customers." },
  reflection: { label: "Reflection", help: "Said what you learned or would do differently, especially in failure and conflict stories." },
  relevance: { label: "Relevance", help: "Answered the question that was asked, with a story that shows the competency it targets." },
  communication: { label: "Communication", help: "Concise, easy to follow answers of about two minutes, with little prompting needed." },
};

export const BEHAVIORAL_WEIGHTS: Record<BehavioralRubricKey, number> = {
  structure: 1.2,
  specificity: 1,
  ownership: 1.2,
  impact: 1.2,
  reflection: 0.8,
  relevance: 1,
  communication: 0.8,
};

const DRILLS: Record<BehavioralRubricKey, { title: string; drill: string }> = {
  structure: {
    title: "Answer in STAR order",
    drill: "Take three stories from your bank and say each one out loud in four beats: one sentence of situation, one of task, three of actions, one of result.",
  },
  specificity: {
    title: "Swap generalities for one real example",
    drill: "For each story, write down three concrete details (the system, the person's role, the date or the number) and use them when you tell it.",
  },
  ownership: {
    title: "Say \"I\" for your part",
    drill: "Re-tell your top story replacing every \"we\" with who actually did it. Keep \"we\" only for the team's shared outcome.",
  },
  impact: {
    title: "End every story with a number",
    drill: "Add a measured result to each story in your bank: time saved, % change, users affected, incidents avoided, money. Estimate if you must, and say so.",
  },
  reflection: {
    title: "Close with what you learned",
    drill: "Add one sentence to each story: \"What I'd do differently is...\" or \"Since then, I always...\". Practice it on your failure and conflict stories first.",
  },
  relevance: {
    title: "Pick the story for the question",
    drill: "Use the coverage matrix on the story bank: for each principle or competency, name the story you'd tell, then fill the gaps.",
  },
  communication: {
    title: "Keep answers to two minutes",
    drill: "Time yourself telling three stories. Aim for 90 seconds to 2 minutes; cut background first, never the actions or the result.",
  },
};

export interface QuestionResult {
  id: string;
  text: string;
  /** When the question was asked, in ms since Start, or null if it never came up. */
  t: number | null;
  answer: string;
  /** Interviewer follow-ups on this question. */
  followUps: number;
  star: Pick<StarAnalysis, "words" | "parts" | "partCount" | "actions" | "hasMetric" | "iRatio" | "reflection" | "length" | "relevance" | "shows" | "score"> | null;
  gaps: { gap: StarGap; text: string }[];
  /** Names of the company principles this answer shows. */
  principles: string[];
}

export interface BehavioralExtra {
  questions: QuestionResult[];
  company: string | null;
  principles: { id: string; name: string; shown: boolean }[];
  principlesLabel: string | null;
}

const words = (s: string) => new Set((s.toLowerCase().match(/[a-z']{4,}/g) ?? []).filter((w) => !STOP.has(w)));
const STOP = new Set(["tell", "about", "time", "that", "this", "what", "when", "your", "with", "were", "they", "have", "from", "which", "would", "there", "their", "describe", "walk", "through"]);

/** How much of a question's wording an interviewer turn contains, 0..1. */
function overlap(turn: string, question: BehavioralQuestion): number {
  const q = words(question.text);
  if (!q.size) return 0;
  const t = words(turn);
  let n = 0;
  for (const w of q) if (t.has(w)) n++;
  return n / q.size;
}

/**
 * Finds where each planned question was asked (exactly, or paraphrased by
 * Claude) and gathers the candidate's turns until the next question or the
 * closing "any questions for me?".
 */
export function segmentAnswers(transcript: Turn[], questions: BehavioralQuestion[]) {
  const askedAt: (number | null)[] = questions.map(() => null);
  let next = 0;
  let closeAt = transcript.length;
  transcript.forEach((t, i) => {
    if (t.speaker !== "interviewer") return;
    // Look a couple of questions ahead in case one was skipped.
    for (let j = next; j < Math.min(questions.length, next + 3); j++) {
      if (t.text.includes(questions[j].text) || overlap(t.text, questions[j]) >= 0.6) {
        askedAt[j] = i;
        next = j + 1;
        return;
      }
    }
    if (closeAt === transcript.length && (t.text.includes(YOUR_QUESTIONS) || /\bquestions for me\b/i.test(t.text)) && next > 0) closeAt = i;
  });
  return questions.map((q, j) => {
    const from = askedAt[j];
    if (from === null) return { question: q, t: null, answer: "", followUps: 0 };
    const later = askedAt.slice(j + 1).find((x) => x !== null);
    const to = Math.min(later ?? transcript.length, closeAt > from ? closeAt : transcript.length);
    const span = transcript.slice(from + 1, to);
    return {
      question: q,
      t: transcript[from].t,
      answer: span.filter((x) => x.speaker === "candidate").map((x) => x.text).join(" "),
      followUps: span.filter((x) => x.speaker === "interviewer").length,
    };
  });
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function gradeBehavioral(ctx: GradeContext<BehavioralArtifact>): RoundReport {
  const turns = ctx.transcript;
  const mine = candidateTurns(turns);
  const questions = questionsOf(ctx.artifact);
  const segs = segmentAnswers(turns, questions);
  const asked = segs.filter((s) => s.t !== null);
  const results: QuestionResult[] = segs.map((s) => {
    if (s.t === null) return { id: s.question.id, text: s.question.text, t: null, answer: "", followUps: 0, star: null, gaps: [], principles: [] };
    const a = analyzeAnswer(s.answer, s.question.competencies);
    const shown = [...new Set([...s.question.competencies.filter((c) => a.shows.includes(c) || a.relevance >= 0.5), ...a.shows.slice(0, 2)])];
    return {
      id: s.question.id,
      text: s.question.text,
      t: s.t,
      answer: s.answer,
      followUps: s.followUps,
      star: s.answer
        ? {
            words: a.words,
            parts: a.parts,
            partCount: a.partCount,
            actions: a.actions,
            hasMetric: a.hasMetric,
            iRatio: Math.round(a.iRatio * 100) / 100,
            reflection: a.reflection,
            length: a.length,
            relevance: Math.round(a.relevance * 100) / 100,
            shows: a.shows,
            score: a.score,
          }
        : null,
      gaps: s.answer ? a.gaps.map((g) => ({ gap: g, text: GAP_TEXT[g] })) : [],
      principles: s.answer && a.words >= 40 ? principlesShown(ctx.config.company, shown).map((p) => p.name) : [],
    };
  });
  const answered = results.filter((r) => r.t !== null);
  const stars = answered.map((r) => r.star);
  const talk = talkMetrics(turns);
  const per = (f: (s: NonNullable<QuestionResult["star"]>) => number) => mean(stars.map((s) => (s ? f(s) : 0)));

  const structure = per((s) => s.partCount / 4);
  const specificity = per((s) => (s.hasMetric ? 0.6 : 0) + (s.length === "ok" ? 0.4 : s.length === "long" ? 0.25 : 0));
  const ownership = per((s) => (s.iRatio >= 0.6 ? 1 : s.iRatio >= 0.45 ? 0.6 : 0.25) * (s.actions >= 2 ? 1 : s.actions === 1 ? 0.7 : 0.4));
  const impact = per((s) => (s.parts.result ? (s.hasMetric ? 1 : 0.55) : 0));
  const reflection = per((s) => (s.reflection ? 1 : 0));
  const relevance = per((s) => s.relevance * (s.words >= 40 ? 1 : 0.5));
  const okShare = per((s) => (s.length === "ok" ? 1 : 0));
  const followUps = mean(answered.map((r) => r.followUps));
  const metricCount = stars.filter((s) => s?.hasMetric).length;
  const reflectCount = stars.filter((s) => s?.reflection).length;

  const rubric: Record<BehavioralRubricKey, RoundScore> = {
    structure: {
      score: scoreFromFraction(structure, [0.3, 0.55, 0.8]),
      evidence: `Your answers covered ${Math.round(structure * 4 * 10) / 10} of the four STAR parts on average.`,
    },
    specificity: {
      score: scoreFromFraction(specificity, [0.25, 0.5, 0.8]),
      evidence: `${plural(metricCount, "answer")} of ${answered.length} had concrete numbers; ${plural(stars.filter((s) => s?.length === "short").length, "answer was", "answers were")} too short to show detail.`,
    },
    ownership: {
      score: scoreFromFraction(ownership, [0.3, 0.55, 0.8]),
      evidence: `"I" was ${Math.round(per((s) => s.iRatio) * 100)}% of your first-person pronouns, with about ${Math.round(per((s) => s.actions) * 10) / 10} "I did..." statements per answer.`,
    },
    impact: {
      score: scoreFromFraction(impact, [0.3, 0.55, 0.85]),
      evidence: `${plural(stars.filter((s) => s?.parts.result).length, "answer")} stated an outcome, ${metricCount} with a measured result.`,
    },
    reflection: {
      score: scoreFromFraction(reflection, [0.2, 0.4, 0.7]),
      evidence: reflectCount ? `You reflected on what you learned in ${plural(reflectCount, "answer")}.` : "No answer said what you learned or would do differently.",
    },
    relevance: {
      score: scoreFromFraction(relevance, [0.3, 0.55, 0.8]),
      evidence: `On average your stories spoke to ${Math.round(relevance * 100)}% of what each question targeted.`,
    },
    communication: {
      score: clampScore((okShare >= 0.7 ? 3 : okShare >= 0.4 ? 2 : 1) + (talk.fillersPer100 > 6 ? -1 : 0) + (followUps <= 1 && okShare >= 0.5 ? 1 : 0)),
      evidence: `${Math.round(okShare * 100)}% of answers were a good length (about ${SHORT_WORDS}-${LONG_WORDS} words), with ${Math.round(followUps * 10) / 10} follow-up${Math.round(followUps * 10) / 10 === 1 ? "" : "s"} per question${talk.fillersPer100 > 4 ? ` and ${talk.fillersPer100} filler words per 100` : ""}.`,
    },
  };
  if (!mine.length) for (const k of BEHAVIORAL_RUBRIC) rubric[k] = { score: 1, evidence: "Nothing was said in this round." };

  const overall = weighted(rubric, BEHAVIORAL_WEIGHTS);
  const realAnswers = answered.filter((r) => (r.star?.words ?? 0) >= 40).length;
  // Ending well before the time box with questions left unasked caps the signal.
  const endedEarly = results.some((r) => r.t === null) && ctx.durationMs < ctx.config.minutes * 60_000 * 0.6;
  const cap = realAnswers < 2 ? "no" : endedEarly ? "lean-hire" : undefined;
  const signal = roundHireSignal(overall, roundBarShift(ctx.config.company, ctx.config.level), cap);

  const cp = principlesFor(ctx.config.company);
  const shownNames = new Set(results.flatMap((r) => r.principles));
  const principles = (cp?.principles ?? []).map((p) => ({ id: p.id, name: p.name, shown: shownNames.has(p.name) }));
  const closeIdx = turns.findIndex((t) => t.speaker === "interviewer" && (t.text.includes(YOUR_QUESTIONS) || /\bquestions for me\b/i.test(t.text)));
  const askedBack = closeIdx >= 0 && turns.slice(closeIdx + 1).some((t) => t.speaker === "candidate" && /\?|\b(what|how|curious|wondering)\b/i.test(t.text) && !/^\s*(no|nope|none)\b/i.test(t.text));

  const checks: RoundCheck[] = [
    { label: "Got through every question", ok: results.length > 0 && results.every((r) => r.t !== null), detail: `${asked.length} of ${results.length}` },
    { label: "Answered every question asked", ok: asked.length > 0 && answered.every((r) => (r.star?.words ?? 0) >= 40), detail: `${realAnswers} of ${asked.length}` },
    { label: "Used the STAR structure in most answers", ok: stars.filter((s) => (s?.partCount ?? 0) >= 3).length >= Math.ceil(answered.length / 2) && answered.length > 0 },
    { label: "Put numbers on results", ok: metricCount >= Math.ceil(answered.length / 2) && answered.length > 0, detail: `${metricCount} of ${answered.length}` },
    { label: "Said \"I\" for your own actions", ok: per((s) => s.iRatio) >= 0.55 },
    { label: "Reflected on lessons learned", ok: reflectCount >= 1 },
    { label: "Kept answers to about two minutes", ok: okShare >= 0.6 },
    { label: "Asked the interviewer a question", ok: askedBack },
  ];
  if (cp) checks.push({ label: `Showed a third or more of the ${cp.label}`, ok: principles.filter((p) => p.shown).length >= Math.ceil(principles.length / 3), detail: `${principles.filter((p) => p.shown).length} of ${principles.length}` });

  const moments: RoundMoment[] = [];
  const probeLines = new Map(Object.entries(PROBES).flatMap(([k, lines]) => lines.map((l) => [l, k] as const)));
  answered.forEach((r, i) => moments.push({ t: r.t!, tone: "info", text: `Question ${i + 1}: ${r.text}` }));
  for (const t of turns) {
    if (t.speaker !== "interviewer") continue;
    const kind = probeLines.get(t.text);
    if (kind === "personal") moments.push({ t: t.t, tone: "warn", text: "Interviewer had to ask what you personally did." });
    else if (kind === "outcome" || kind === "metric") moments.push({ t: t.t, tone: "warn", text: "Interviewer had to ask for the result." });
    else if (kind === "situation") moments.push({ t: t.t, tone: "warn", text: "Interviewer asked for more context." });
  }
  for (const r of answered) if (r.star && r.star.score >= 4) moments.push({ t: r.t!, tone: "good", text: `Strong answer: "${r.text.slice(0, 60)}…"` });
  moments.sort((a, b) => a.t - b.t);

  const best = [...BEHAVIORAL_RUBRIC].sort((a, b) => rubric[b].score - rubric[a].score || BEHAVIORAL_WEIGHTS[b] - BEHAVIORAL_WEIGHTS[a])[0];
  const worst = [...BEHAVIORAL_RUBRIC].sort((a, b) => rubric[a].score - rubric[b].score || BEHAVIORAL_WEIGHTS[b] - BEHAVIORAL_WEIGHTS[a])[0];
  const reasons = [
    rubric.structure.score >= 3 ? "Answers followed a clear situation, action, result arc." : "Answers were missing parts of the STAR arc.",
    rubric.ownership.score >= 3 ? "Clear about your own part." : "Hard to tell what you did versus the team.",
    rubric.impact.score >= 3 ? "Results were stated and mostly measured." : "Results were vague or missing.",
  ];
  if (cp) reasons.push(`Showed ${principles.filter((p) => p.shown).length} of ${principles.length} ${cp.label}.`);
  if (endedEarly) reasons.push(`Ended early: ${plural(results.filter((r) => r.t === null).length, "question was", "questions were")} never reached.`);

  const extra: BehavioralExtra = { questions: results, company: ctx.config.company, principles, principlesLabel: cp?.label ?? null };
  return {
    generator: "heuristic",
    summary: !mine.length
      ? "The round ended before you said anything, so there's nothing to grade yet."
      : rubric[best].score <= 2
        ? `There wasn't enough in these answers to judge yet. Start with ${BEHAVIORAL_INFO[worst].label.toLowerCase()}, and use the story bank to prepare.`
        : rubric[worst].score >= 4
          ? "Every part of the rubric was strong."
          : `Strongest: ${BEHAVIORAL_INFO[best].label.toLowerCase()}. Biggest gap: ${BEHAVIORAL_INFO[worst].label.toLowerCase()}.`,
    rubric,
    overall,
    hire: { signal, reasons },
    strengths: strengthsFrom(rubric, BEHAVIORAL_INFO),
    focus: focusFrom(rubric, BEHAVIORAL_WEIGHTS, DRILLS),
    checks,
    moments,
    extra: extra as unknown as Record<string, unknown>,
  };
}

export function behavioralGraderBrief(topicId: string): string {
  const topic = BEHAVIORAL_TOPIC_BY_ID.get(topicId);
  const qs = (topic?.questionIds ?? []).flatMap((id) => (QUESTION_BY_ID.has(id) ? [QUESTION_BY_ID.get(id)!] : []));
  return `A strong behavioral answer uses a real, specific example; sets up the situation and the candidate's task briefly; spends most of its time on the candidate's own actions ("I", not "we"); ends with a measured result; and, for failure or conflict questions, says what they learned or would do differently. About two minutes spoken.
Question set: ${topic?.title ?? topicId}. The round asks the first few, as time allows.
${qs.map((q, i) => `Question ${i + 1}: ${q.text} (tests: ${q.competencies.map(competencyLabel).join(", ")})`).join("\n")}`;
}
