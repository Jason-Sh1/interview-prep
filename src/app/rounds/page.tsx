import Link from "next/link";
import { Tag } from "@/components/badges";
import { listAssistedSessions } from "@/lib/assisted";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { listDebugRounds } from "@/lib/comprehension";
import { getRoundSuggestions } from "@/lib/rounds";
import { builtKinds } from "@/lib/rounds/registry";
import { ROUND_INFO } from "@/lib/rounds/types";
import { getTrackState } from "@/lib/track";

/** Every interview format besides the daily problems and voice mocks. */
export default async function RoundsPage() {
  const { user, goals } = await requireOnboardedUser();
  const [assisted, debug, { plan }] = await Promise.all([listAssistedSessions(user.id), listDebugRounds(user.id), getTrackState(user.id, goals)]);
  const { suggestions, history } = await getRoundSuggestions(user.id, goals, plan.daysLeft);
  const suggested = new Map(suggestions.map((s) => [s.kind, s]));

  const formats = [
    {
      href: "/assisted",
      title: "AI-assisted coding",
      body: "A small repo and an AI assistant, graded on how you prompt, review and own the code. Modeled on Meta's and Shopify's AI-enabled rounds.",
      last: assisted[0]?.startedAt ?? null,
      reason: null as string | null,
    },
    {
      href: "/debug",
      title: "Comprehension and debugging",
      body: "Read an unfamiliar repo, explain it, and find the bugs seeded in it, with or without an assistant.",
      last: debug[0]?.startedAt ?? null,
      reason: null,
    },
    ...builtKinds().map((k) => ({
      href: ROUND_INFO[k].path,
      title: ROUND_INFO[k].label,
      body: ROUND_INFO[k].blurb,
      last: history.find((h) => h.kind === k)?.last ?? null,
      reason: suggested.get(k)?.reason ?? null,
    })),
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Interview rounds</h1>
      <p className="mt-1 text-muted">
        Real loops mix formats. Your daily plan covers the coding fundamentals and{" "}
        <Link href="/mock" className="text-accent hover:underline">
          mock interviews
        </Link>{" "}
        cover talking through a problem; these cover the rest.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {formats.map((f) => (
          <li key={f.href}>
            <Link href={f.href} className="card flex h-full flex-col p-4 text-sm transition-colors hover:border-accent">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{f.title}</span>
                {f.reason && <Tag tone="accent">Suggested</Tag>}
              </div>
              <p className="mt-1 flex-1 text-muted">{f.reason ?? f.body}</p>
              <p className="mt-2 text-xs text-muted" suppressHydrationWarning>
                {f.last ? `Last done ${f.last.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "Not tried yet"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
