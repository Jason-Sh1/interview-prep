// Rule-based STAR checks for a spoken or typed behavioral answer and for a
// stored story: which STAR parts are there, numbers in the result, "I" versus
// "we", reflection, length, and relevance to the question. Pure and safe to
// import from the browser (the story editor runs these live).
import { mentionsGroup, wordCount, type KeywordGroups } from "../rounds/analyze";
import { COMPETENCY_BY_ID, suggestCompetencies, type CompetencyId } from "./competencies";

export type StarPart = "situation" | "task" | "action" | "result";
export const STAR_PARTS: StarPart[] = ["situation", "task", "action", "result"];

const SITUATION: KeywordGroups = [
  ["when i was", "while i was", "back when", "back in", "at the time", "at my last", "at my previous", "at my internship", "during my", "during the", "during our"],
  ["last year", "last summer", "a few years ago", "a couple of years ago", "years ago", "months ago", "last semester", "this semester"],
  ["the situation", "the context", "the background", "for context", "the problem was", "the issue was", "it started when"],
  ["our team", "my team", "the team was", "we were", "i was working", "i was on", "i was an intern", "i was interning", "i worked at", "i was at"],
];
const TASK: KeywordGroups = [
  ["my goal", "the goal", "our goal", "the objective", "my job was", "my role was", "my task", "the task"],
  ["i was responsible", "i was asked", "i was tasked", "i needed to", "i had to", "we needed to", "we had to", "i was supposed to"],
  ["the challenge", "the deadline", "the requirement", "the ask was", "it was my responsibility", "i owned"],
];
const RESULT: KeywordGroups = [
  ["as a result", "in the end", "ended up", "the outcome", "the result", "outcome was", "result was", "at the end", "eventually", "finally"],
  ["reduced", "increased", "improved", "saved", "cut", "grew", "doubled", "halved", "tripled", "dropped", "went from", "went down", "went up"],
  ["launched", "shipped", "delivered", "released", "rolled out", "adopted", "promoted", "praised", "recognized", "awarded"],
  ["which meant", "this meant", "that meant", "led to", "resulted in", "so that"],
];
const REFLECTION: KeywordGroups = [
  ["i learned", "learned that", "i've learned", "lesson", "takeaway", "taught me"],
  ["differently", "next time", "in hindsight", "looking back", "if i did it again", "if i could do it again", "would have", "should have"],
  ["i realized", "realised", "since then", "now i always", "now i make sure", "these days i", "going forward"],
];

/** Past-tense verbs that make "I ..." an action. */
const ACTION_VERBS = [
  "built", "wrote", "designed", "implemented", "created", "set", "started", "led", "organized", "organised", "scheduled", "proposed", "suggested",
  "decided", "talked", "spoke", "met", "asked", "reached", "called", "emailed", "messaged", "pinged", "escalated", "explained", "presented", "showed",
  "pulled", "dug", "investigated", "debugged", "traced", "profiled", "measured", "analyzed", "analysed", "tested", "reviewed", "refactored", "rewrote",
  "migrated", "fixed", "patched", "rolled", "deployed", "shipped", "launched", "automated", "documented", "drafted", "prototyped", "broke", "split",
  "prioritized", "prioritised", "cut", "negotiated", "convinced", "persuaded", "mentored", "coached", "paired", "helped", "volunteered", "took", "owned",
  "made", "put", "added", "removed", "replaced", "ran", "worked", "focused", "gathered", "collected", "interviewed", "listened", "apologized", "apologised",
  "learned", "read", "researched", "compared", "chose", "picked", "pushed", "flagged", "raised", "wrote up", "kept", "updated", "followed", "went", "got",
];
const ACTION_RE = new RegExp(`\\bi\\s+(?:then\\s+|also\\s+|first\\s+|quickly\\s+|personally\\s+|actually\\s+)?(?:${ACTION_VERBS.map((v) => v.replace(" ", "\\s+")).join("|")})\\b`, "gi");
const PLAN_RE = /\b(first|then|next|after that|so i|i decided|my plan|step one|the first thing)\b/i;

const METRIC_RE =
  /(\b\d+(?:[.,]\d+)?\s*(?:%|percent|x\b|ms\b|milliseconds|seconds|minutes|hours|days|weeks|months|k\b|m\b|users|customers|people|engineers|requests|qps|tickets|bugs|teams|services|lines|dollars|\$)|\$\s?\d|\b\d+(?:[.,]\d+)?\s*(?:times|fold)\b|\bfrom\s+\d[^.]{0,40}?\bto\s+\d|\b(doubled|halved|tripled|quadrupled)\b)/i;
const NUMBER_RE = /\b\d+(?:[.,]\d+)?\b/;

const I_RE = /\b(i|i'm|i've|i'd|me|my|myself)\b/gi;
const WE_RE = /\b(we|we're|we've|we'd|us|our|ours)\b/gi;

export const SHORT_WORDS = 70;
export const LONG_WORDS = 450;

export interface StarAnalysis {
  words: number;
  parts: Record<StarPart, boolean>;
  /** How many of the four parts are there. */
  partCount: number;
  /** "I ..." action statements. */
  actions: number;
  hasMetric: boolean;
  hasNumber: boolean;
  iCount: number;
  weCount: number;
  /** Share of first-person pronouns that are "I" rather than "we", 0..1 (0.5 with neither). */
  iRatio: number;
  reflection: boolean;
  length: "short" | "ok" | "long";
  /** Share of the question's competencies the answer speaks to, 0..1 (1 when the question has none). */
  relevance: number;
  /** Competencies the answer shows, strongest first. */
  shows: CompetencyId[];
  /** 1..4 for this answer. */
  score: number;
  /** What's missing, most important first, as short labels. */
  gaps: StarGap[];
}

export type StarGap = "detail" | "action" | "ownership" | "result" | "metric" | "situation" | "reflection" | "relevance" | "rambling";

export const GAP_TEXT: Record<StarGap, string> = {
  detail: "Too short to follow: add the situation, what you did and how it ended.",
  situation: "Set the scene: where, when, and what was at stake.",
  action: "Say what you actually did, step by step.",
  ownership: "Mostly \"we\": say what you personally did.",
  result: "No clear outcome: say how it ended.",
  metric: "No numbers in the result: how much, how fast, how many?",
  reflection: "No reflection: what you learned or would do differently.",
  relevance: "Drifted from the question: tie the story back to what was asked.",
  rambling: "Long: trim the background and get to your actions sooner.",
};

const count = (re: RegExp, s: string) => (s.match(re) ?? []).length;

/** STAR analysis of one answer (all the candidate said for one question, follow-ups included). */
export function analyzeAnswer(text: string, competencies: readonly CompetencyId[] = []): StarAnalysis {
  const words = wordCount(text);
  const lower = text.toLowerCase();
  const actions = count(ACTION_RE, lower);
  const iCount = count(I_RE, lower);
  const weCount = count(WE_RE, lower);
  const iRatio = iCount + weCount ? iCount / (iCount + weCount) : 0.5;
  const hasMetric = METRIC_RE.test(text);
  const hasNumber = NUMBER_RE.test(text);
  const resultWords = RESULT.some((g) => mentionsGroup(text, g));
  const parts: Record<StarPart, boolean> = {
    situation: SITUATION.some((g) => mentionsGroup(text, g)) || (words >= 60 && /\b(at|in|during)\s+(my|our|a|an|the)\b/i.test(text.slice(0, 300))),
    task: TASK.some((g) => mentionsGroup(text, g)),
    action: actions >= 2 || (actions >= 1 && PLAN_RE.test(text)),
    result: resultWords || hasMetric,
  };
  const partCount = STAR_PARTS.filter((p) => parts[p]).length;
  const reflection = REFLECTION.some((g) => mentionsGroup(text, g));
  const length = words < SHORT_WORDS ? "short" : words > LONG_WORDS ? "long" : "ok";
  const shows = suggestCompetencies(text, 4);
  const relevance = competencies.length
    ? competencies.filter((c) => shows.includes(c) || mentionsGroup(text, COMPETENCY_BY_ID.get(c)?.keywords.flat() ?? [])).length / competencies.length
    : 1;

  const gaps: StarGap[] = [];
  if (length === "short") gaps.push("detail");
  if (!parts.action) gaps.push("action");
  else if (iRatio < 0.45 && weCount >= 3) gaps.push("ownership");
  if (!parts.result) gaps.push("result");
  else if (!hasMetric) gaps.push("metric");
  if (!parts.situation && length !== "short") gaps.push("situation");
  if (!reflection) gaps.push("reflection");
  if (relevance < 0.5 && length !== "short") gaps.push("relevance");
  if (length === "long") gaps.push("rambling");

  let points = 1 + partCount * 0.5; // 1..3
  if (hasMetric) points += 0.5;
  if (iRatio >= 0.55 && actions >= 2) points += 0.5;
  if (reflection) points += 0.25;
  if (length === "short") points -= 1;
  if (length === "long") points -= 0.25;
  if (relevance < 0.5) points -= 0.5;
  const score = Math.min(4, Math.max(1, Math.round(points)));

  return { words, parts, partCount, actions, hasMetric, hasNumber, iCount, weCount, iRatio, reflection, length, relevance, shows, score, gaps };
}

export interface StoryFields {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  competencies: string[];
}

export interface StoryCheck {
  id: string;
  label: string;
  ok: boolean;
  /** How to fix it, when not ok. */
  hint?: string;
}

/** The checks the story editor shows live. */
export function checkStory(s: StoryFields): StoryCheck[] {
  const total = wordCount(`${s.situation} ${s.task} ${s.action} ${s.result}`);
  const sitWords = wordCount(s.situation);
  const actionLower = s.action.toLowerCase();
  const iA = count(I_RE, actionLower);
  const weA = count(WE_RE, actionLower);
  return [
    { id: "title", label: "Has a short title you'll recognize", ok: s.title.trim().length >= 3 && s.title.length <= 90, hint: "A few words, like \"Payments outage on launch day\"." },
    { id: "situation", label: "Situation filled in", ok: sitWords >= 8, hint: "One or two sentences: where you were, when, and what was at stake." },
    { id: "situation-short", label: "Situation is brief", ok: sitWords <= 80, hint: "Keep the background under about 80 words; interviewers want the actions." },
    { id: "task", label: "Task: your goal or responsibility", ok: wordCount(s.task) >= 5, hint: "What were you specifically asked or trying to do?" },
    { id: "action", label: "Actions are concrete", ok: wordCount(s.action) >= 25, hint: "Two to four steps you took, in order." },
    { id: "first-person", label: "Actions say \"I\", not just \"we\"", ok: iA > 0 && iA >= weA, hint: "Rewrite the actions in the first person: what did you do?" },
    { id: "result", label: "Result filled in", ok: wordCount(s.result) >= 6, hint: "How did it end? What changed because of you?" },
    { id: "metric", label: "Result has a number", ok: METRIC_RE.test(s.result) || NUMBER_RE.test(s.result), hint: "Add a measure: time saved, % change, users affected, money." },
    { id: "length", label: "Tellable in about two minutes", ok: total >= 80 && total <= LONG_WORDS, hint: total < 80 ? "Add detail: aim for 150 to 350 words in total." : "Trim it: a spoken answer over about 450 words drags." },
    { id: "competencies", label: "Tagged with what it shows", ok: s.competencies.length > 0, hint: "Tag one to three competencies so you can find it for the right question." },
  ];
}

export const storyText = (s: Pick<StoryFields, "title" | "situation" | "task" | "action" | "result">) => `${s.title}. ${s.situation} ${s.task} ${s.action} ${s.result}`;

/** Splits a free-form answer into rough STAR fields, for saving it to the story bank. */
export function splitIntoStar(text: string): Pick<StoryFields, "situation" | "task" | "action" | "result"> {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = { situation: [] as string[], task: [] as string[], action: [] as string[], result: [] as string[] };
  let stage: StarPart = "situation";
  for (const s of sentences) {
    const lower = s.toLowerCase();
    const isTask = TASK.some((g) => mentionsGroup(s, g));
    const isAction = count(ACTION_RE, lower) > 0;
    // "As a result", "led to", a number or a lesson mark the result; words like "dropped" only do outside an "I did..." sentence.
    const strongResult = mentionsGroup(s, RESULT[0]) || mentionsGroup(s, RESULT[3]) || METRIC_RE.test(s) || REFLECTION.some((g) => mentionsGroup(s, g));
    const isResult = strongResult || (!isAction && RESULT.some((g) => mentionsGroup(s, g)));
    if (stage !== "result" && isResult && (stage === "action" || out.action.length)) stage = "result";
    else if ((stage === "situation" || stage === "task") && isAction && !isTask) stage = "action";
    else if (stage === "situation" && isTask) stage = "task";
    out[stage].push(s);
  }
  if (!out.action.length && out.situation.length > 1) out.action = out.situation.splice(1);
  return { situation: out.situation.join(" "), task: out.task.join(" "), action: out.action.join(" "), result: out.result.join(" ") };
}
