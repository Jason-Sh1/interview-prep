import Link from "next/link";
import { Tag } from "@/components/badges";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { COMPANIES, COMPANY_BY_ID, emphasisFor } from "@/lib/engine/companies";
import { mediumSolveChance, patternStatus, skillOf } from "@/lib/engine/mastery";
import { PHASE_INFO } from "@/lib/engine/planner";
import { PATTERNS } from "@/lib/problems";
import { getTrackState } from "@/lib/track";

/** Cell color for a 0–1 skill value, from red through amber to green. */
function heat(v: number): string {
  const hue = Math.round(v * 130);
  return `hsl(${hue} 60% 45% / ${0.25 + v * 0.55})`;
}

export default async function ProgressPage() {
  const { user, goals } = await requireOnboardedUser();
  const { skills, attempts, cards, plan } = await getTrackState(user.id, goals);
  const targets = goals.targetCompanies.length ? goals.targetCompanies.map((t) => COMPANY_BY_ID[t]).filter(Boolean) : COMPANIES.slice(0, 3);

  const readiness = targets.map((c) => {
    let num = 0;
    let den = 0;
    for (const p of PATTERNS) {
      const w = emphasisFor(c.id, p.id);
      num += w * mediumSolveChance(p.id, skills);
      den += w;
    }
    return { company: c, value: num / den };
  });

  const learned = PATTERNS.filter((p) => patternStatus(p.id, skills) === "learned").length;
  const started = PATTERNS.filter((p) => skillOf(skills, p.id).attempts > 0).length;
  const solvedCount = new Set(attempts.filter((a) => a.solved).map((a) => a.problemSlug)).size;

  // A server component renders once per request, so reading the clock here is safe.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  // Projected coverage: at the recent pace, how many more patterns get learned by the interview?
  const twoWeeksAgo = now - 14 * 86_400_000;
  const recentSolves = attempts.filter((a) => a.solved && a.finishedAt.getTime() >= twoWeeksAgo).length;
  const solvesPerWeek = recentSolves / 2;
  const weeksLeft = plan.daysLeft !== null ? plan.daysLeft / 7 : null;
  const projected =
    weeksLeft !== null ? Math.min(PATTERNS.length, learned + Math.floor((solvesPerWeek * weeksLeft) / 3)) : null;

  const totalWeeks = weeksLeft !== null ? Math.max(1, Math.ceil(weeksLeft)) : null;
  const dueSoon = cards.filter((c) => c.due.getTime() <= now + 7 * 86_400_000).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Skill map</h1>
      <p className="mt-1 text-sm text-muted">
        Ratings per pattern against what your target companies ask. Company profiles are starting estimates until the weekly research job keeps them current.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Problems solved" value={solvedCount} />
        <Stat label="Patterns learned" value={`${learned}/${PATTERNS.length}`} sub={`${started} started`} />
        <Stat label="Reviews due this week" value={dueSoon} />
        <Stat label="Phase" value={PHASE_INFO[plan.phase].label} sub={plan.daysLeft !== null ? `${plan.daysLeft} days left` : "No date set"} />
      </div>

      <section className="mt-8">
        <h2 className="font-medium">Readiness by company</h2>
        <p className="text-xs text-muted">Weighted chance of solving a typical medium, using each company&apos;s pattern mix.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {readiness.map(({ company, value }) => (
            <div key={company.id} className="card p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{company.name}</span>
                <span className="text-lg font-semibold tabular-nums">{Math.round(value * 100)}%</span>
              </div>
              <div className="mt-2 h-2 rounded bg-surface-2">
                <div className="h-2 rounded" style={{ width: `${value * 100}%`, background: heat(value) }} />
              </div>
              <p className="mt-2 text-xs text-muted">{company.style}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 overflow-x-auto">
        <h2 className="font-medium">Patterns</h2>
        <table className="mt-3 w-full min-w-[640px] border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="font-normal">Pattern</th>
              <th className="font-normal">Your rating</th>
              {targets.map((c) => (
                <th key={c.id} className="text-center font-normal">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PATTERNS.map((p) => {
              const s = skillOf(skills, p.id);
              const chance = mediumSolveChance(p.id, skills);
              const status = patternStatus(p.id, skills);
              return (
                <tr key={p.id}>
                  <td className="pr-3">
                    <Link href={`/problems#${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>{" "}
                    {status === "locked" && <span className="text-xs text-muted">🔒</span>}
                  </td>
                  <td className="w-40 pr-3">
                    <div className="rounded px-2 py-1 text-xs tabular-nums" style={{ background: s.attempts ? heat(chance) : undefined }}>
                      {s.attempts ? (
                        <>
                          {Math.round(s.rating)} <span className="opacity-70">± {Math.round(s.uncertainty)}</span>
                        </>
                      ) : (
                        <span className="text-muted">not started</span>
                      )}
                    </div>
                  </td>
                  {targets.map((c) => {
                    const w = emphasisFor(c.id, p.id);
                    const gap = w * (1 - chance);
                    return (
                      <td key={c.id} className="text-center">
                        <span
                          title={`${c.name} emphasis ${Math.round(w * 100)}%`}
                          className="inline-block rounded-full"
                          style={{
                            width: 6 + w * 14,
                            height: 6 + w * 14,
                            background: gap > 0.35 ? "var(--bad)" : gap > 0.2 ? "var(--warn)" : "var(--good)",
                            opacity: 0.85,
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">Dot size: how much the company leans on the pattern. Color: red where it matters and you&apos;re not there yet.</p>
      </section>

      <section className="mt-8">
        <h2 className="font-medium">Plan timeline</h2>
        {totalWeeks === null ? (
          <p className="mt-2 text-sm text-muted">
            <Link href="/onboarding" className="text-accent hover:underline">
              Add an interview date
            </Link>{" "}
            to see weekly phases and projected coverage.
          </p>
        ) : (
          <>
            <div className="mt-3 flex gap-1">
              {Array.from({ length: totalWeeks }, (_, i) => {
                const daysFromEnd = (totalWeeks - i) * 7;
                const ph = daysFromEnd <= 14 ? "final" : daysFromEnd <= 42 ? "strengthen" : "breadth";
                return (
                  <div
                    key={i}
                    title={`Week ${i + 1}: ${PHASE_INFO[ph].label}`}
                    className={`h-8 flex-1 rounded ${i === 0 ? "ring-2 ring-accent" : ""} ${ph === "final" ? "bg-bad-soft" : ph === "strengthen" ? "bg-warn-soft" : "bg-accent-soft"}`}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
              <Tag tone="accent">Build breadth</Tag>
              <Tag tone="warn">Strengthen</Tag>
              <Tag tone="bad">Final stretch</Tag>
              <span>This week is outlined.</span>
            </div>
            <p className="mt-3 text-sm">
              At your recent pace ({solvesPerWeek.toFixed(1)} solves a week), you&apos;re on track to have about{" "}
              <strong>{projected}</strong> of {PATTERNS.length} patterns learned by your interview.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
