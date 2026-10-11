import type { Difficulty } from "@/lib/problems/types";

const DIFF_STYLE: Record<Difficulty, string> = {
  easy: "bg-good-soft text-good",
  medium: "bg-warn-soft text-warn",
  hard: "bg-bad-soft text-bad",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium capitalize ${DIFF_STYLE[difficulty]}`}>
      {difficulty}
    </span>
  );
}

export function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "good" | "warn" | "bad" }) {
  const styles = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
  };
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}
