import { PROBLEMS } from "./index";
import type { Problem } from "./types";

const slugOf = (url: string) => url.match(/problems\/([^/?#\s]+)/i)?.[1]?.toLowerCase() ?? null;
const titleOf = (p: Problem) => p.source!.name.replace(/^leetcode\s*\d+\.?\s*/i, "").toLowerCase();

/** Matches pasted LeetCode links or titles to problems in the bank, exactly (so "two-sum-ii" doesn't match "two-sum"). */
export function matchImported(text: string, problems: Problem[] = PROBLEMS): string[] {
  const lines = text
    .split(/[\n,]/)
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
  const slugs = new Set(lines.map(slugOf).filter(Boolean));
  const titles = new Set(lines.flatMap((l) => [l, l.replace(/^\d+\.\s*/, ""), l.replace(/-/g, " ")]));
  const found = new Set<string>();
  for (const p of problems) {
    if (!p.source) continue;
    const lcSlug = slugOf(p.source.url);
    if ((lcSlug && (slugs.has(lcSlug) || titles.has(lcSlug))) || titles.has(titleOf(p))) found.add(p.slug);
  }
  return [...found];
}
