import Link from "next/link";
import { DifficultyBadge, Tag } from "@/components/badges";
import { SourceList } from "@/components/SourceList";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { PHASE_INFO, type ItemKind } from "@/lib/engine/planner";
import { PATTERN_BY_ID } from "@/lib/problems/patterns";
import { PROBLEM_BY_SLUG } from "@/lib/problems";
import { listAssistedSessions } from "@/lib/assisted";
import { listDebugRounds } from "@/lib/comprehension";
import { listMockSessions } from "@/lib/mock";
import { getWhatsNew, type WhatsNewItem } from "@/lib/research";
import { getTrackState } from "@/lib/track";
import { variantsWaiting, type Variant } from "@/lib/variants";

const KIND_LABEL: Record<ItemKind, { label: string; tone: "accent" | "good" | "warn" | "neutral" }> = {
  new: { label: "New", tone: "accent" },
  review: { label: "Review", tone: "good" },
  mixed: { label: "Mixed", tone: "neutral" },
  bridge: { label: "Bridge", tone: "warn" },
  drill: { label: "Drill", tone: "warn" },
};

const MODE_FOR: Record<ItemKind, string> = { new: "learn", bridge: "learn", review: "review", mixed: "mixed", drill: "learn" };

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const { user, goals } = await requireOnboardedUser();
  const { welcome } = await searchParams;
  const [{ plan, attempts, cards }, whatsNew, mocks, rounds, debugRounds] = await Promise.all([
    getTrackState(user.id, goals),
    getWhatsNew(goals.targetCompanies).catch(() => [] as WhatsNewItem[]),
    listMockSessions(user.id),
    listAssistedSessions(user.id),
    listDebugRounds(user.id),
  ]);
  // A server component renders once per request, so reading the clock here is safe.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const lastMock = mocks[0]?.startedAt ?? null;
  const lastRound = rounds[0]?.startedAt ?? null;
  const lastDebug = debugRounds[0]?.startedAt ?? null;
  // Spec 4.2: the final stretch favors mocks; suggest one if none in the last three days.
  const suggestMock = plan.phase === "final" && (!lastMock || now - lastMock.getTime() > 3 * 86_400_000);
  const phase = PHASE_INFO[plan.phase];
  const totalMinutes = plan.items.reduce((m, i) => m + i.minutes, 0);
  const twists = await variantsWaiting(
    user.id,
    plan.items.filter((i) => i.kind === "review" && cards.some((c) => c.problemSlug === i.slug && c.reps > 0)).map((i) => i.slug),
  ).catch(() => new Map<string, Variant>());
  const todayAttempts = attempts.filter((a) => plan.doneToday.includes(a.problemSlug));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      {welcome && (
        <div className="card mb-6 border-accent bg-accent-soft p-4 text-sm">
          Your plan is ready. It re-plans after every attempt, so just work down the list.
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Today</h1>
          <p className="mt-1 text-sm text-muted">
            {phase.label}: {phase.focus}
          </p>
        </div>
        <div className="text-right text-sm text-muted">
          {plan.daysLeft !== null && (
            <div>
              <span className="text-lg font-semibold text-ink">{plan.daysLeft}</span> days to your interview
            </div>
          )}
          <div>
            About {totalMinutes} of your {plan.minutesBudget} minutes a day
          </div>
        </div>
      </div>

      {plan.stuck.length > 0 && (
        <div className="card mt-6 border-warn bg-warn-soft p-4 text-sm">
          {plan.stuck.map((p) => (
            <p key={p}>
              <strong>{PATTERN_BY_ID[p].name}:</strong> two misses in a row. Refresh the idea first: {PATTERN_BY_ID[p].summary}{" "}
              <Link className="underline" href={`/problems#${p}`}>
                See the pattern
              </Link>
            </p>
          ))}
        </div>
      )}

      {suggestMock && (
        <Link href="/mock" className="card mt-6 flex items-center gap-4 border-accent bg-accent-soft p-4 transition-colors hover:border-accent">
          <div className="flex-1">
            <div className="font-medium">Do a mock interview today</div>
            <p className="mt-1 text-sm text-muted">
              You&apos;re in the final stretch. Talking through a problem under time pressure is the part solo practice can&apos;t build, and the report
              feeds your weak spots back into this plan.
            </p>
          </div>
          <span className="btn-primary shrink-0">Start a mock</span>
        </Link>
      )}

      <ol className="mt-6 space-y-3">
        {plan.items.map((item, i) => {
          const p = PROBLEM_BY_SLUG.get(item.slug)!;
          const kind = KIND_LABEL[item.kind];
          return (
            <li key={item.slug}>
              <Link
                href={`/problems/${item.slug}?mode=${MODE_FOR[item.kind]}`}
                className="card flex items-start gap-4 p-4 transition-colors hover:border-accent"
              >
                <span className="mt-0.5 w-5 text-sm text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.hidePattern ? `Mixed problem ${i + 1}` : p.title}</span>
                    <Tag tone={kind.tone}>{kind.label}</Tag>
                    <DifficultyBadge difficulty={p.difficulty} />
                    {!item.hidePattern && <Tag>{PATTERN_BY_ID[p.pattern].name}</Tag>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {item.kind === "review" && twists.has(item.slug) ? `Review with a twist: ${twists.get(item.slug)!.data.twist}` : item.reason}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted">~{item.minutes} min</span>
              </Link>
            </li>
          );
        })}
      </ol>
      {plan.items.length === 0 && (
        <div className="card mt-6 p-6 text-center text-muted">
          {plan.doneToday.length ? "You're done for today. Reviews and new problems will be waiting tomorrow." : "Nothing is open right now."}{" "}
          <Link href="/problems" className="text-accent hover:underline">
            Browse the problem bank
          </Link>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-medium text-muted">Other interview formats</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <FormatCard
            href="/mock"
            title="Mock interview"
            body="A live voice interview on one problem, with a report on your code and communication."
            last={lastMock}
          />
          <FormatCard
            href="/assisted"
            title="AI-assisted round"
            body="A small repo and an AI assistant, graded on how you prompt, review and own the code."
            last={lastRound}
          />
          <FormatCard
            href="/debug"
            title="Comprehension and debugging"
            body="Read an unfamiliar repo, explain it, and find the bugs seeded in it, with or without an assistant."
            last={lastDebug}
          />
        </div>
      </section>

      {whatsNew.length > 0 && <WhatsNew items={whatsNew} targets={goals.targetCompanies} />}

      {todayAttempts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-muted">Done today</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {[...new Map(todayAttempts.map((a) => [a.problemSlug, a])).values()].map((a) => (
              <li key={a.problemSlug} className="flex items-center gap-2">
                <span className={a.solved ? "text-good" : "text-bad"}>{a.solved ? "✓" : "✗"}</span>
                <Link href={`/problems/${a.problemSlug}`} className="hover:underline">
                  {PROBLEM_BY_SLUG.get(a.problemSlug)?.title}
                </Link>
                {a.mode === "review" && <Tag tone="good">Review</Tag>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function WhatsNew({ items, targets }: { items: WhatsNewItem[]; targets: string[] }) {
  const shown = items.slice(0, 4);
  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-muted">What&apos;s new in interviews</h2>
      <p className="text-xs text-muted">From this week&apos;s research. Your plan already reflects it.</p>
      <ul className="mt-2 space-y-2">
        {shown.map((item) => (
          <li key={item.companyId} className="card p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{item.name}</span>
              {targets.includes(item.companyId) && <Tag tone="accent">Your target</Tag>}
              <span className="text-xs text-muted" suppressHydrationWarning>
                {item.approvedAt.toLocaleDateString(undefined, { dateStyle: "medium" })}
              </span>
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {item.changes.slice(0, 4).map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            {item.sources.length > 0 && (
              <div className="mt-1 text-xs text-muted">
                Sources: <SourceList sources={item.sources} compact />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FormatCard({ href, title, body, last }: { href: string; title: string; body: string; last: Date | null }) {
  return (
    <Link href={href} className="card block p-4 text-sm transition-colors hover:border-accent">
      <div className="font-medium">{title}</div>
      <p className="mt-1 text-muted">{body}</p>
      <p className="mt-2 text-xs text-muted" suppressHydrationWarning>
        {last ? `Last done ${last.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "Not tried yet"}
      </p>
    </Link>
  );
}
