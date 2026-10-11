import Link from "next/link";
import { DifficultyBadge, Tag } from "@/components/badges";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { isProblemOpen, patternStatus, skillOf, type PatternStatus } from "@/lib/engine/mastery";
import { PATTERN_BY_ID } from "@/lib/problems/patterns";
import { PATTERNS, PROBLEMS, problemsForPattern } from "@/lib/problems";
import { getTrackState } from "@/lib/track";

const STATUS: Record<PatternStatus, { label: string; tone: "neutral" | "accent" | "good" | "warn" }> = {
  locked: { label: "Locked", tone: "neutral" },
  unlocked: { label: "Ready", tone: "accent" },
  learning: { label: "Learning", tone: "warn" },
  learned: { label: "Learned", tone: "good" },
};

export default async function ProblemsPage() {
  const { user, goals } = await requireOnboardedUser();
  const { skills, attempts, cards } = await getTrackState(user.id, goals);
  const solved = new Set(attempts.filter((a) => a.solved).map((a) => a.problemSlug));
  const due = new Set(cards.filter((c) => c.due <= new Date()).map((c) => c.problemSlug));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Problem bank</h1>
      <p className="mt-1 text-sm text-muted">
        {PROBLEMS.length} problems across {PATTERNS.length} patterns. Patterns open as you build a working rating in their prerequisites; harder problems open as your rating in the pattern rises.
      </p>
      <div className="mt-8 space-y-6">
        {PATTERNS.map((pattern) => {
          const status = patternStatus(pattern.id, skills);
          const skill = skillOf(skills, pattern.id);
          return (
            <section key={pattern.id} id={pattern.id} className="card scroll-mt-20 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{pattern.name}</h2>
                <Tag tone={STATUS[status].tone}>{STATUS[status].label}</Tag>
                {skill.attempts > 0 && <span className="text-xs text-muted">rating {Math.round(skill.rating)}</span>}
              </div>
              <p className="mt-1 text-sm text-muted">{pattern.summary}</p>
              {status === "locked" && (
                <p className="mt-1 text-xs text-muted">
                  Opens after: {pattern.prerequisites.map((p) => PATTERN_BY_ID[p].name).join(", ")}
                </p>
              )}
              <ul className="mt-3 divide-y divide-line">
                {problemsForPattern(pattern.id).map((p) => {
                  const open = isProblemOpen(p, skills, solved, PROBLEMS);
                  return (
                    <li key={p.slug} className="flex items-center gap-3 py-2 text-sm">
                      <span className={`w-4 ${solved.has(p.slug) ? "text-good" : "text-transparent"}`}>✓</span>
                      {open ? (
                        <Link href={`/problems/${p.slug}${due.has(p.slug) ? "?mode=review" : ""}`} className="hover:text-accent hover:underline">
                          {p.title}
                        </Link>
                      ) : (
                        <span className="text-muted">{p.title}</span>
                      )}
                      <DifficultyBadge difficulty={p.difficulty} />
                      {due.has(p.slug) && <Tag tone="good">Review due</Tag>}
                      {!open && <span className="ml-auto text-xs text-muted">🔒 locked</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
