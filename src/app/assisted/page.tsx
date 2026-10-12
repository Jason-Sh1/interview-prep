import Link from "next/link";
import { Tag } from "@/components/badges";
import { HIRE_LABELS } from "@/lib/feedback/analyze";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { assistantKind, listAssistedSessions } from "@/lib/assisted";
import { TASKS } from "@/lib/assisted/tasks";
import { startAssistedAction } from "./actions";

export default async function AssistedPage() {
  const { user } = await requireOnboardedUser();
  const sessions = await listAssistedSessions(user.id);
  const kind = assistantKind();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">AI-assisted coding round</h1>
      <p className="mt-1 text-muted">
        Meta now runs a coding round with an AI assistant built into the editor, Google is piloting one, and many startups allow AI tools.
        These rounds grade how you work with the assistant: how you break the task down, how good your prompts are, whether you catch its
        mistakes, and whether you own the final code.
      </p>

      <div className="card mt-6 space-y-1 p-4 text-sm">
        <p>
          <span className="font-medium">How it works:</span> a small multi-file repo with tests, and a chat assistant beside the editor. There is
          no &quot;apply&quot; button: you paste or type its code yourself, as Meta requires. Some answers contain a subtle bug on purpose,
          revealed in your report. When you finish, you explain your change.
        </p>
        <p>
          <span className="font-medium">Assistant:</span>{" "}
          {kind === "claude"
            ? "Claude, with a choice of Sonnet, Haiku or Opus."
            : "an offline practice assistant with canned answers for each task (set ANTHROPIC_API_KEY to chat with Claude and pick a model)."}
        </p>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Pick a task</h2>
      <ul className="mt-3 space-y-3">
        {TASKS.map((t) => (
          <li key={t.id} className="card p-4">
            <div className="font-medium">{t.title}</div>
            <p className="mt-1 text-sm">{t.summary}</p>
            <p className="mt-1 text-xs text-muted">Like: {t.modeledOn}</p>
            <form action={startAssistedAction} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="task" value={t.id} />
              <select name="minutes" className="input w-auto" defaultValue="45" aria-label="Length">
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
              </select>
              <button className="btn-primary">Start</button>
            </form>
          </li>
        ))}
      </ul>

      {sessions.length > 0 && (
        <>
          <h2 className="mt-12 text-lg font-semibold">Past rounds</h2>
          <ul className="mt-3 space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/assisted/${s.id}`} className="card flex flex-wrap items-center gap-2 p-3 text-sm hover:border-accent">
                  <span className="font-medium">{s.task.title}</span>
                  {!s.endedAt && <Tag tone="warn">Not finished</Tag>}
                  {s.report && <Tag tone={s.report.hire.signal.includes("hire") && !s.report.hire.signal.startsWith("lean") ? "good" : "neutral"}>{HIRE_LABELS[s.report.hire.signal]}</Tag>}
                  <span className="ml-auto text-muted">{s.startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
