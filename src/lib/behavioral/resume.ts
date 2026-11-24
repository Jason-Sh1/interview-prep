// Drafting story seeds from a resume without Claude: resume bullets that start
// with an action verb become stories with the title, action and result
// prefilled (the result is the clause with a number, when there is one), under
// the role they sit beneath. Pure, so it's unit tested.
import { suggestCompetencies } from "./competencies";

export interface StoryDraft {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  competencies: string[];
}

export const MAX_RESUME_CHARS = 60_000;
const MAX_DRAFTS = 10;

const VERBS = new Set(
  (
    "achieved accelerated added analyzed analysed architected automated boosted built championed coached collaborated conceived consolidated " +
    "contributed coordinated created cut debugged decreased defined delivered deployed designed developed directed doubled drove eliminated " +
    "enabled engineered established expanded founded grew halved headed helped identified implemented improved increased initiated integrated " +
    "introduced investigated launched led maintained managed mentored migrated modernized optimized optimised organized organised overhauled " +
    "owned partnered piloted pioneered prototyped published rebuilt redesigned reduced refactored replaced resolved restructured revamped " +
    "rewrote saved scaled secured shipped simplified spearheaded standardized streamlined taught tested trained transformed tripled troubleshot " +
    "unified upgraded wrote ran won"
  ).split(" "),
);

const BULLET_RE = /^\s*(?:[-*•▪◦●‣·–]|\d+[.)])\s*/;
const METRIC_RE = /\d|\b(doubled|halved|tripled)\b/i;
const RESULT_SPLIT =
  /,?\s*(?:\bthat (?=[a-z]+ed\b)|\bresulting in\b|\bwhich\b|\bleading to\b|\breducing\b|\bincreasing\b|\bimproving\b|\bcutting\b|\bsaving\b|\bboosting\b|\benabling\b|\bachieving\b|\bto (?:reduce|increase|improve|cut|save|support|serve|enable)\b|;|\s[-–—]\s)/i;
const DATE_RE = /\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(19|20)?\d{2}\b|\bpresent\b|\bcurrent\b/i;
const SECTION_RE = /^(experience|work experience|professional experience|employment|projects|education|skills|technical skills|summary|awards|publications|leadership|activities|volunteer(ing)?|interests|certifications)\s*:?$/i;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const sentenceCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const stripEnd = (s: string) => s.replace(/[\s.;,]+$/, "");

/** Splits pasted or extracted resume text into lines, breaking on bullet characters too. */
export function resumeLines(text: string): string[] {
  return text
    .slice(0, MAX_RESUME_CHARS)
    .replace(/\r/g, "")
    .split(/\n|(?=\s[•▪◦●‣]\s)/)
    .map((l) => l.replace(/\t/g, " "))
    .filter((l) => l.trim());
}

/** A role or project heading: short, not a bullet, often with a date, a "|" or " at ". */
function isHeading(line: string): boolean {
  const l = clean(line);
  if (BULLET_RE.test(line) || l.length > 110 || l.length < 3) return false;
  if (SECTION_RE.test(l)) return false;
  const first = l.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
  if (VERBS.has(first)) return false;
  return DATE_RE.test(l) || /\s[|@]\s|\sat\s|,\s/.test(l) || /\b(engineer|intern|developer|analyst|scientist|lead|manager|researcher|assistant|founder)\b/i.test(l);
}

function headingContext(line: string): string {
  // Drop dates and separators: "Software Engineer | Acme Corp | 2022 - Present" -> "Software Engineer, Acme Corp".
  return clean(
    line
      .replace(/\(?\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(19|20)?\d{2}\b\)?/gi, "")
      .replace(/\(?\b(19|20)\d{2}\b\)?/g, "")
      .replace(/\b(present|current|spring|summer|fall|autumn|winter)\b/gi, "")
      .replace(/\s*[|•·]\s*/g, ", ")
      .replace(/\s+[-–—]\s*(?=,|$)/g, "")
      .replace(/[-–—]\s*$/g, ""),
  )
    .replace(/(,\s*)+/g, ", ")
    .replace(/^,\s*|,\s*$/g, "");
}

function titleFrom(action: string): string {
  const words = stripEnd(action).split(" ");
  const t = words.slice(0, 9).join(" ");
  return stripEnd(words.length > 9 ? t.replace(/\s+(and|to|for|with|of|the|a|an|in|on|by)$/i, "") : t);
}

/** Story seeds from resume text, strongest first (action verb plus a number). */
export function draftStoriesFromResume(text: string): StoryDraft[] {
  const seeds: (StoryDraft & { score: number; order: number })[] = [];
  let context = "";
  let order = 0;
  for (const raw of resumeLines(text)) {
    const line = clean(raw.replace(BULLET_RE, ""));
    if (SECTION_RE.test(line)) continue;
    if (isHeading(raw)) {
      context = headingContext(raw);
      continue;
    }
    const first = line.split(" ")[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
    if (!VERBS.has(first) || line.split(" ").length < 5) continue;
    const m = RESULT_SPLIT.exec(line);
    let action = line;
    let result = "";
    if (m && m.index > 15) {
      action = line.slice(0, m.index);
      // Keep the verb ("reducing deploy time by 60%"), drop connectives ("which", "resulting in").
      result = line
        .slice(m.index)
        .replace(/^[,;\s–—-]+/, "")
        .replace(/^(which|that|resulting in|leading to)\s+/i, "");
    }
    action = sentenceCase(stripEnd(action));
    result = result ? sentenceCase(stripEnd(result)) : "";
    seeds.push({
      title: titleFrom(action),
      situation: context ? `Role: ${context}.` : "",
      task: "",
      action: `I ${action[0].toLowerCase()}${action.slice(1)}.`,
      result: result ? `${result}.` : "",
      competencies: suggestCompetencies(line, 3),
      score: (METRIC_RE.test(line) ? 2 : 0) + (result ? 1 : 0) + Math.min(1, line.length / 120),
      order: order++,
    });
  }
  const seen = new Set<string>();
  return seeds
    .filter((s) => {
      const k = s.title.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, MAX_DRAFTS)
    .map((s): StoryDraft => ({ title: s.title, situation: s.situation, task: s.task, action: s.action, result: s.result, competencies: s.competencies }));
}
