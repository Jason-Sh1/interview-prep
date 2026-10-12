import Link from "next/link";
import { Tag } from "@/components/badges";
import { COMPANIES } from "@/lib/engine/companies";
import { PATTERNS } from "@/lib/problems/patterns";
import { getApprovedProfiles, getReviewQueue, listRuns, researchEnabled, seedProfiles, type ProfileVersion } from "@/lib/research";
import { requireAdmin } from "@/lib/research/admin";
import { AI_POLICY_LABEL, EMPHASIS_THRESHOLD } from "@/lib/research/profiles";
import { SourceList } from "@/components/SourceList";
import { reviewProfileAction } from "./actions";
import { RunButton } from "./RunButton";

const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { dateStyle: "medium" });
const fmtTime = (d: Date) => d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const RUN_TONE: Record<string, "good" | "warn" | "bad" | "neutral" | "accent"> = {
  running: "accent",
  done: "good",
  failed: "bad",
  skipped: "neutral",
};

// Runs started here finish in after(), which is bounded by this route's limit.
export const maxDuration = 800;

export default async function ResearchPage() {
  await requireAdmin();
  await seedProfiles();
  const [queue, approved, runs] = await Promise.all([getReviewQueue(), getApprovedProfiles(), listRuns()]);
  const enabled = researchEnabled();
  // A server component renders once per request, so reading the clock here is safe.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const running = runs.some((r) => r.status === "running" && now - r.startedAt.getTime() < 3_600_000);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Company research</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Every week Claude searches for recent reports on each company&apos;s coding interviews. A profile that changes waits here for review; approving it
            updates every user&apos;s plan. A profile that still holds is marked verified.
          </p>
        </div>
        <RunButton disabled={!enabled || running} label={running ? "Research running…" : "Run research now"} />
      </div>
      {!enabled && (
        <p className="card mt-4 border-warn bg-warn-soft p-3 text-sm">
          Research needs <code>ANTHROPIC_API_KEY</code>. Until it&apos;s set, the planner uses the built-in estimates below.
        </p>
      )}

      <h2 className="mt-8 text-lg font-semibold">
        Review queue {queue.length > 0 && <span className="text-muted">({queue.length})</span>}
      </h2>
      {queue.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Nothing waiting for review.</p>
      ) : (
        <div className="mt-2 space-y-4">
          {queue.map(({ pending, current }) => (
            <QueueCard key={pending.id} pending={pending} current={current} />
          ))}
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold">Live profiles</h2>
      <div className="card mt-2 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Version</th>
              <th className="px-3 py-2 font-medium">AI in coding rounds</th>
              <th className="px-3 py-2 font-medium">Last verified</th>
              <th className="px-3 py-2 font-medium">Sources</th>
            </tr>
          </thead>
          <tbody>
            {COMPANIES.map((c) => {
              const v = approved.get(c.id);
              return (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2">{v ? `v${v.version}${v.generator === "seed" ? " (estimate)" : ""}` : "estimate"}</td>
                  <td className="px-3 py-2">{v ? AI_POLICY_LABEL[v.data.ai] : AI_POLICY_LABEL.unknown}</td>
                  <td className="px-3 py-2" suppressHydrationWarning>
                    {v?.verifiedAt ? fmtDate(v.verifiedAt) : <span className="text-muted">Never</span>}
                  </td>
                  <td className="px-3 py-2">{v?.sources.length ? <SourceList sources={v.sources} compact /> : <span className="text-muted">None</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Recent runs</h2>
      {runs.length === 0 ? (
        <p className="mt-1 text-sm text-muted">No runs yet. The weekly run starts Monday mornings once CRON_SECRET is set; you can also run it here or with npm run research.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {runs.map((r) => {
            const count = (k: string) => r.results.filter((x) => x.result === k).length;
            const failed = r.results.filter((x) => x.result === "failed");
            return (
              <li key={r.id} className="card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={RUN_TONE[r.status] ?? "neutral"}>{r.status}</Tag>
                  <span suppressHydrationWarning>{fmtTime(r.startedAt)}</span>
                  <span className="text-muted">· {r.trigger}</span>
                  {r.results.length > 0 && (
                    <span className="text-muted">
                      · {count("queued")} to review, {count("unchanged")} unchanged, {failed.length} failed
                    </span>
                  )}
                </div>
                {r.error && <p className="mt-1 text-muted">{r.error}</p>}
                {failed.length > 0 && (
                  <ul className="mt-1 text-muted">
                    {failed.map((f) => (
                      <li key={f.companyId}>
                        {f.companyId}: {f.error}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-sm">
        <Link href="/progress" className="text-accent hover:underline">
          See how the profiles shape the skill map
        </Link>
      </p>
    </main>
  );
}

function QueueCard({ pending, current }: { pending: ProfileVersion; current: ProfileVersion | null }) {
  const before = current?.data;
  const after = pending.data;
  const moved = PATTERNS.map((p) => ({ p, a: before?.emphasis[p.id] ?? 0.3, b: after.emphasis[p.id] ?? 0.3 })).filter(
    (x) => Math.abs(x.b - x.a) >= EMPHASIS_THRESHOLD - 1e-9,
  );
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{after.name}</h3>
        <Tag tone="accent">v{pending.version}</Tag>
        <span className="text-xs text-muted" suppressHydrationWarning>
          Researched {fmtTime(pending.createdAt)}
          {current ? ` · replaces v${current.version}` : ""}
        </span>
      </div>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
        {pending.changes.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>

      <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-muted">Now</div>
          <p className="mt-0.5">{before?.style ?? "—"}</p>
          {before?.loop && <p className="mt-1 text-muted">{before.loop}</p>}
          <p className="mt-1 text-muted">{AI_POLICY_LABEL[before?.ai ?? "unknown"]}</p>
        </div>
        <div>
          <div className="text-xs font-medium text-muted">Proposed</div>
          <p className="mt-0.5">{after.style}</p>
          {after.loop && <p className="mt-1 text-muted">{after.loop}</p>}
          <p className="mt-1 text-muted">{AI_POLICY_LABEL[after.ai]}</p>
        </div>
      </div>

      {moved.length > 0 && (
        <table className="mt-3 text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="pr-4 font-medium">Pattern weight</th>
              <th className="pr-4 font-medium">Now</th>
              <th className="font-medium">Proposed</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {moved.map(({ p, a, b }) => (
              <tr key={p.id}>
                <td className="pr-4">{p.name}</td>
                <td className="pr-4">{a.toFixed(2)}</td>
                <td className={b > a ? "text-good" : "text-bad"}>{b.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-3 text-sm">
        <div className="text-xs font-medium text-muted">Sources</div>
        <SourceList sources={pending.sources} />
      </div>

      <div className="mt-4 flex gap-2">
        <form action={reviewProfileAction}>
          <input type="hidden" name="id" value={pending.id} />
          <button name="decision" value="approved" className="btn-primary">
            Approve
          </button>
        </form>
        <form action={reviewProfileAction}>
          <input type="hidden" name="id" value={pending.id} />
          <button name="decision" value="rejected" className="btn-secondary">
            Reject
          </button>
        </form>
      </div>
    </section>
  );
}
