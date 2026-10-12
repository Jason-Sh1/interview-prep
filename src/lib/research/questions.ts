// Question frequency (spec 4.6): which problems each company is reported to
// ask, how often, and where that was reported. Research versions carry their
// own list; until a company has one, its estimate comes from the problem
// bank's own company lists. Pure helpers; the database side is in ./index.ts.
import type { Problem } from "../problems/types";
import type { Source } from "./profiles";

export const FREQUENCIES = ["high", "medium", "low"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** How strongly each label pulls a problem up the plan (0..1). */
export const FREQUENCY_WEIGHT: Record<Frequency, number> = { high: 1, medium: 0.75, low: 0.4 };

export const FREQUENCY_LABEL: Record<Frequency, string> = { high: "Asked often", medium: "Asked sometimes", low: "Asked rarely" };

export interface QuestionReport {
  /** The public problem's name, e.g. "Two Sum". */
  title: string;
  /** Link to the public problem, when known. We store links, not problem text. */
  url?: string;
  /** The bank problem modeled on it, when there is one. */
  problemSlug: string | null;
  frequency: Frequency;
  /** When it was last reported (YYYY-MM or YYYY-MM-DD), if the source says. */
  lastSeen?: string;
  sources: Source[];
}

const leetcodeSlug = (url: string | undefined) => url?.match(/leetcode\.com\/problems\/([a-z0-9-]+)/i)?.[1]?.toLowerCase() ?? null;
const normTitle = (t: string) =>
  t
    .toLowerCase()
    .replace(/^leetcode\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Matches a reported question to a bank problem by its public problem link or title. */
export function matchProblem(title: string, url: string | undefined, problems: Problem[]): Problem | null {
  const slug = leetcodeSlug(url);
  const t = normTitle(title);
  for (const p of problems) {
    if (!p.source) continue;
    if (slug && leetcodeSlug(p.source.url) === slug) return p;
    if (t && normTitle(p.source.name) === t) return p;
  }
  return null;
}

/** What the bank's own company lists say a company asks, before any research. */
export function estimatedQuestions(companyName: string, problems: Problem[]): QuestionReport[] {
  const name = companyName.toLowerCase();
  return problems
    .filter((p) => p.companies.some((c) => c.toLowerCase() === name))
    .map((p) => ({
      title: p.source ? p.source.name.replace(/^leetcode\s*\d*\.?\s*/i, "") : p.title,
      ...(p.source ? { url: p.source.url } : {}),
      problemSlug: p.slug,
      frequency: "medium" as const,
      sources: [],
    }));
}

export interface RawQuestion {
  title: string;
  url?: string;
  frequency: Frequency;
  lastSeen?: string;
  sourceUrl: string;
}

/**
 * Cleans what the research model reported: every question needs a source the
 * searches actually returned, duplicates collapse to the highest frequency,
 * and each is matched to a bank problem when possible.
 */
export function cleanQuestions(raw: RawQuestion[], verify: (url: string) => Source | null, problems: Problem[], max = 20): QuestionReport[] {
  const out = new Map<string, QuestionReport>();
  for (const q of raw) {
    const title = q.title.trim().slice(0, 120);
    const source = verify(q.sourceUrl);
    if (!title || !source) continue;
    const url = q.url && /^https?:\/\//.test(q.url) ? q.url.trim() : undefined;
    const match = matchProblem(title, url, problems);
    const key = match?.slug ?? leetcodeSlug(url) ?? normTitle(title);
    const prev = out.get(key);
    if (prev) {
      if (FREQUENCY_WEIGHT[q.frequency] > FREQUENCY_WEIGHT[prev.frequency]) prev.frequency = q.frequency;
      if (!prev.sources.some((s) => s.url === source.url)) prev.sources.push(source);
      continue;
    }
    out.set(key, {
      title,
      ...(url ? { url } : {}),
      problemSlug: match?.slug ?? null,
      frequency: q.frequency,
      ...(q.lastSeen ? { lastSeen: q.lastSeen } : {}),
      sources: [source],
    });
  }
  return [...out.values()].sort((a, b) => FREQUENCY_WEIGHT[b.frequency] - FREQUENCY_WEIGHT[a.frequency]).slice(0, max);
}

const keyOf = (q: QuestionReport) => q.problemSlug ?? leetcodeSlug(q.url) ?? normTitle(q.title);

/** Changes worth a reviewer's attention: newly reported common questions and frequency moves. */
export function diffQuestions(prev: QuestionReport[], next: QuestionReport[]): string[] {
  const before = new Map(prev.map((q) => [keyOf(q), q]));
  const added: string[] = [];
  const up: string[] = [];
  const down: string[] = [];
  for (const q of next) {
    const p = before.get(keyOf(q));
    if (!p) {
      if (q.frequency !== "low") added.push(q.title);
    } else if (p.frequency !== q.frequency) {
      (FREQUENCY_WEIGHT[q.frequency] > FREQUENCY_WEIGHT[p.frequency] ? up : down).push(q.title);
    }
  }
  const list = (xs: string[]) => (xs.length > 5 ? `${xs.slice(0, 5).join(", ")} and ${xs.length - 5} more` : xs.join(", "));
  const changes: string[] = [];
  if (added.length) changes.push(`Newly reported questions: ${list(added)}.`);
  if (up.length) changes.push(`Asked more often: ${list(up)}.`);
  if (down.length) changes.push(`Asked less often: ${list(down)}.`);
  return changes;
}

/**
 * How strongly the target companies are reported to ask each bank problem
 * (0..1, the highest across targets). Problems nobody reports are absent.
 */
export function problemFrequency(targets: string[], byCompany: Map<string, QuestionReport[]>): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of targets) {
    for (const q of byCompany.get(t) ?? []) {
      if (!q.problemSlug) continue;
      out.set(q.problemSlug, Math.max(out.get(q.problemSlug) ?? 0, FREQUENCY_WEIGHT[q.frequency]));
    }
  }
  return out;
}
