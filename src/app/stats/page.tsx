import { usageStats } from "@/lib/analytics-db";
import { requireAdmin } from "@/lib/research/admin";

// Usage at a glance for whoever runs the site (the research reviewers):
// totals per week only, never individual users.
export default async function StatsPage() {
  await requireAdmin();
  const weeks = await usageStats();
  const latest = weeks.at(-1)!;
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.activeUsers, w.sessionsCompleted)));
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Usage</h1>
      <p className="mt-1 text-sm text-muted">
        Counted from the app&apos;s own tables: no tracking scripts or cookies, and totals only. Weeks start on Monday (UTC).
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Active users this week" value={latest.activeUsers} />
        <Stat label="Sessions completed this week" value={latest.sessionsCompleted} hint="Mocks, AI-assisted and debugging rounds" />
        <Stat label="Practice attempts this week" value={latest.completed.practice} />
      </div>

      <table className="mt-8 w-full text-sm">
        <caption className="mb-2 text-left font-medium">Last {weeks.length} weeks</caption>
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="py-1 font-normal">Week of</th>
            <th className="py-1 font-normal">Active users</th>
            <th className="py-1 font-normal">Sessions completed</th>
            <th className="py-1 text-right font-normal">Mocks</th>
            <th className="py-1 text-right font-normal">AI-assisted</th>
            <th className="py-1 text-right font-normal">Debugging</th>
            <th className="py-1 text-right font-normal">Practice</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekStart} className="border-t border-line">
              <td className="py-1.5 tabular-nums">{w.weekStart}</td>
              <td className="py-1.5">
                <Bar value={w.activeUsers} max={max} />
              </td>
              <td className="py-1.5">
                <Bar value={w.sessionsCompleted} max={max} />
              </td>
              <td className="py-1.5 text-right tabular-nums">{w.completed.mock}</td>
              <td className="py-1.5 text-right tabular-nums">{w.completed.assisted}</td>
              <td className="py-1.5 text-right tabular-nums">{w.completed.debug}</td>
              <td className="py-1.5 text-right tabular-nums">{w.completed.practice}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-surface-2">
        <div className="h-2 rounded-full bg-accent" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
