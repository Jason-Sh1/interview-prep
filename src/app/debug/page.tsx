import Link from "next/link";
import { Tag } from "@/components/badges";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { listDebugRounds } from "@/lib/comprehension";
import { DEBUG_TASKS } from "@/lib/comprehension/tasks";
import { HIRE_LABELS } from "@/lib/feedback/analyze";
import { claudeEnabled } from "@/lib/interview/claude";
import { startDebugAction } from "./actions";

export default async function DebugPage() {
  const { user } = await requireOnboardedUser();
  const rounds = await listDebugRounds(user.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Code comprehension and debugging</h1>
      <p className="mt-1 text-muted">
        Google is piloting a round where you read an unfamiliar codebase, explain it, and find and fix bugs, with an AI assistant allowed; other
        companies run &quot;debug this code&quot; rounds because they test understanding instead of memorized solutions.
      </p>

      <div className="card mt-6 space-y-1 p-4 text-sm">
        <p>
          <span className="font-medium">How it works:</span> a small JavaScript repo with a few bugs seeded in it. Some tests fail at the start,
          but not every bug has a failing test. When you finish you answer a few questions about the code and write up each bug. Hidden tests then
          check which bugs you fixed and whether you broke anything.
        </p>
        <p>
          <span className="font-medium">Assistant (optional):</span>{" "}
          {claudeEnabled()
            ? "Claude can explain code and help you reason, but won't hand you the bugs."
            : "an offline helper that explains the code (set ANTHROPIC_API_KEY to use Claude)."}
        </p>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Pick a codebase</h2>
      <ul className="mt-3 space-y-3">
        {DEBUG_TASKS.map((t) => (
          <li key={t.id} className="card p-4">
            <div className="font-medium">{t.title}</div>
            <p className="mt-1 text-sm">{t.summary}</p>
            <p className="mt-1 text-xs text-muted">Like: {t.modeledOn}</p>
            <form action={startDebugAction} className="mt-3 flex flex-wrap items-center gap-3">
              <input type="hidden" name="task" value={t.id} />
              <select name="minutes" className="input w-auto" defaultValue="45" aria-label="Length">
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
              </select>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="assistant" defaultChecked /> AI assistant
              </label>
              <button className="btn-primary">Start</button>
            </form>
          </li>
        ))}
      </ul>

      {rounds.length > 0 && (
        <>
          <h2 className="mt-12 text-lg font-semibold">Past rounds</h2>
          <ul className="mt-3 space-y-2">
            {rounds.map((r) => (
              <li key={r.id}>
                <Link href={`/debug/${r.id}`} className="card flex flex-wrap items-center gap-2 p-3 text-sm hover:border-accent">
                  <span className="font-medium">{r.task.title}</span>
                  {!r.endedAt && <Tag tone="warn">Not finished</Tag>}
                  {r.report && (
                    <>
                      <Tag tone={r.report.bugs.every((b) => b.fixed) ? "good" : "neutral"}>
                        {r.report.bugs.filter((b) => b.fixed).length}/{r.report.bugs.length} bugs fixed
                      </Tag>
                      <Tag>{HIRE_LABELS[r.report.hire.signal]}</Tag>
                    </>
                  )}
                  <span className="ml-auto text-muted">{r.startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
