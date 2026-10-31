// When Today suggests a conversation round (system design, behavioral, code
// walkthrough). Suggestions only: they never change the DSA plan or pattern
// ratings. Pure, so it's unit tested.
import type { RoundFocus, RoundKind } from "./types";

export interface RoundHistory {
  kind: RoundKind;
  /** When the most recent round of this kind was started (or created), if any. */
  last: Date | null;
  /** The top focus area from the latest graded round of this kind. */
  focus: RoundFocus | null;
}

export interface RoundSuggestion {
  kind: RoundKind;
  reason: string;
  focus: RoundFocus | null;
}

export interface SuggestInput {
  level: string;
  daysLeft: number | null;
  targets: string[];
  /** Each target company's reported loop (from approved research), lowercased is fine. */
  loops: Record<string, string>;
  history: RoundHistory[];
  /** Kinds that exist in the app. */
  built: RoundKind[];
  now?: Date;
}

const DAY = 86_400_000;
const daysSince = (d: Date | null, now: Date) => (d ? (now.getTime() - d.getTime()) / DAY : Infinity);

const LOOP_WORDS: Record<RoundKind, RegExp> = {
  design: /\b(system design|design round|architecture)\b/i,
  behavioral: /\b(behaviou?ral|leadership principles?|googleyness|culture|values)\b/i,
  walkthrough: /\b(take[- ]home|walkthrough|walk[- ]through|project deep[- ]dive|past project|code review)\b/i,
};

/** Companies whose loop is known for a round of this kind even without research. */
const KNOWN: Record<RoundKind, string[]> = {
  design: [],
  behavioral: ["amazon"],
  walkthrough: ["stripe", "shopify", "startup"],
};

export function suggestRounds(input: SuggestInput): RoundSuggestion[] {
  const now = input.now ?? new Date();
  const close = input.daysLeft !== null && input.daysLeft <= 28;
  const final = input.daysLeft !== null && input.daysLeft <= 14;
  const senior = input.level === "senior" || input.level === "staff";
  const out: RoundSuggestion[] = [];
  const hist = (k: RoundKind) => input.history.find((h) => h.kind === k) ?? { kind: k, last: null, focus: null };
  const inLoop = (k: RoundKind) =>
    input.targets.filter((t) => KNOWN[k].includes(t) || LOOP_WORDS[k].test(input.loops[t] ?? ""));

  for (const kind of input.built) {
    const h = hist(kind);
    const since = daysSince(h.last, now);
    const companies = inLoop(kind);
    let reason: string | null = null;
    if (kind === "design") {
      const relevant = input.level !== "new-grad" || companies.length > 0;
      if (relevant && ((senior && since > 7) || (close && since > 7) || (companies.length && since > 10)))
        reason = senior
          ? "Design rounds carry the most weight at your level; keep one in your week."
          : companies.length
            ? `Your target loop includes system design (${companies.join(", ")}).`
            : "Your interview is getting close, and most loops from mid-level up include a design round.";
    } else if (kind === "behavioral") {
      if ((close && since > 7) || (companies.length && since > 10) || (h.last === null && input.daysLeft !== null && input.daysLeft <= 42))
        reason = companies.includes("amazon")
          ? "Amazon weighs leadership principles in every round; practice telling your stories out loud."
          : close
            ? "Every loop has a behavioral round, and stories get much better with practice out loud."
            : "Start your story bank early: behavioral rounds are in every loop.";
    } else if (kind === "walkthrough") {
      if ((companies.length && since > 10) || (final && h.last === null))
        reason = companies.length
          ? `Your target loop includes a take-home or project walkthrough (${companies.join(", ")}).`
          : "Many loops ask you to walk through code you wrote; practice defending your decisions once.";
    }
    if (reason) out.push({ kind, reason, focus: h.focus });
  }
  return out;
}
