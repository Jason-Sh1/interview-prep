// Pure helpers for the research job (spec 4.6): the shape of a researched
// company profile, cleaning what the model returns, and deciding whether a
// new version changes anything worth a human review.
import type { CompanyProfile } from "../engine/companies";
import { PATTERNS } from "../problems/patterns";
import type { PatternId } from "../problems/types";

export const AI_POLICIES = ["allowed", "some-rounds", "not-allowed", "unknown"] as const;
export type AiPolicy = (typeof AI_POLICIES)[number];

export const AI_POLICY_LABEL: Record<AiPolicy, string> = {
  allowed: "AI tools allowed",
  "some-rounds": "AI allowed in some rounds",
  "not-allowed": "No AI tools",
  unknown: "AI policy unknown",
};

/** What a profile version holds beyond the company id. */
export interface ProfileData {
  name: string;
  /** One line on how the coding rounds feel. */
  style: string;
  emphasis: Partial<Record<PatternId, number>>;
  /** The loop as currently reported: rounds, formats, length. */
  loop: string;
  ai: AiPolicy;
  /** Short notes a candidate should know (new formats, policy changes). */
  notes: string[];
}

export interface Source {
  url: string;
  title: string;
  /** As reported by the page, when known (YYYY-MM or YYYY-MM-DD). */
  published?: string;
}

export function profileFromEstimate(c: CompanyProfile): ProfileData {
  return { name: c.name, style: c.style, emphasis: { ...c.emphasis }, loop: "", ai: "unknown", notes: [] };
}

const PATTERN_IDS = new Set<string>(PATTERNS.map((p) => p.id));

/** Clamps to 0..1, rounds to 0.05, and drops unknown patterns and near-zero weights. */
export function cleanEmphasis(raw: Record<string, number>): Partial<Record<PatternId, number>> {
  const out: Partial<Record<PatternId, number>> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!PATTERN_IDS.has(k) || !Number.isFinite(v)) continue;
    const r = Math.round(Math.min(1, Math.max(0, v)) * 20) / 20;
    if (r >= 0.1) out[k as PatternId] = r;
  }
  return out;
}

const normUrl = (u: string) => u.trim().replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();

/** Keeps only sources whose URL was actually returned by a search, deduplicated. */
export function verifiedSources(claimed: Source[], seen: Map<string, { title: string; published?: string }>): Source[] {
  const byNorm = new Map([...seen].map(([u, v]) => [normUrl(u), { url: u, ...v }]));
  const out: Source[] = [];
  const used = new Set<string>();
  for (const s of claimed) {
    const hit = byNorm.get(normUrl(s.url));
    if (!hit || used.has(normUrl(hit.url))) continue;
    used.add(normUrl(hit.url));
    out.push({ url: hit.url, title: s.title || hit.title, ...(s.published || hit.published ? { published: s.published || hit.published } : {}) });
  }
  return out;
}

/** Emphasis moves smaller than this are noise between runs, not news. */
export const EMPHASIS_THRESHOLD = 0.15;
const DEFAULT_EMPHASIS = 0.3;

export function patternName(id: PatternId): string {
  return PATTERNS.find((p) => p.id === id)?.name ?? id;
}

/** Human-readable differences between two versions; empty when nothing material changed. */
export function diffProfiles(prev: ProfileData, next: ProfileData): string[] {
  const changes: string[] = [];
  if (prev.ai !== next.ai && next.ai !== "unknown") {
    changes.push(prev.ai === "unknown" ? `${AI_POLICY_LABEL[next.ai]}.` : `${AI_POLICY_LABEL[prev.ai]} → ${AI_POLICY_LABEL[next.ai].toLowerCase()}.`);
  }
  const up: string[] = [];
  const down: string[] = [];
  for (const p of PATTERNS) {
    const a = prev.emphasis[p.id] ?? DEFAULT_EMPHASIS;
    const b = next.emphasis[p.id] ?? DEFAULT_EMPHASIS;
    if (Math.abs(b - a) >= EMPHASIS_THRESHOLD - 1e-9) (b > a ? up : down).push(p.name);
  }
  if (up.length) changes.push(`More ${up.join(", ")}.`);
  if (down.length) changes.push(`Less ${down.join(", ")}.`);
  if (next.loop && next.loop.trim() !== prev.loop.trim()) changes.push(prev.loop ? `Loop: ${next.loop}` : `Loop reported: ${next.loop}`);
  const oldNotes = new Set(prev.notes.map((n) => n.trim().toLowerCase()));
  for (const n of next.notes) if (!oldNotes.has(n.trim().toLowerCase())) changes.push(n);
  return changes;
}

/** The profile the planner uses, built from a version's data. */
export function toCompanyProfile(id: string, d: ProfileData): CompanyProfile {
  return { id, name: d.name, style: d.style, emphasis: d.emphasis };
}
