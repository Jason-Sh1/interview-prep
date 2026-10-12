import Link from "next/link";
import { Tag } from "@/components/badges";
import { Markdown } from "@/components/Markdown";
import { ReportPending } from "@/components/ReportPending";
import type { AssistedSession } from "@/lib/assisted";
import { ASSISTED_INFO, ASSISTED_RUBRIC } from "@/lib/assisted/grade";
import type { AssistedEvent } from "@/lib/assisted/types";
import { HIRE_LABELS, type HireSignal } from "@/lib/feedback/analyze";
import { fmtClock } from "@/lib/interview/timeline";
import { generateAssistedReportAction } from "../actions";

const SIGNAL_STYLE: Record<HireSignal, string> = {
  "strong-hire": "bg-good-soft text-good",
  hire: "bg-good-soft text-good",
  "lean-hire": "bg-warn-soft text-warn",
  no: "bg-bad-soft text-bad",
  "strong-no": "bg-bad-soft text-bad",
};
const SCORE_BAR = ["", "bg-bad", "bg-warn", "bg-good", "bg-good"];
const OUTCOME: Record<string, { label: string; tone: "good" | "bad" | "neutral" | "warn" }> = {
  caught: { label: "Caught", tone: "good" },
  missed: { label: "Missed", tone: "bad" },
  avoided: { label: "Not used", tone: "neutral" },
  unclear: { label: "Unclear", tone: "warn" },
};

export function AssistedReportView({ session, events, usesClaude }: { session: AssistedSession; events: AssistedEvent[]; usesClaude: boolean }) {
  const r = session.report;
  const durationMs = (session.endedAt ?? session.startedAt).getTime() - session.startedAt.getTime();
  const chat = events.filter((e): e is Extract<AssistedEvent, { type: "prompt" | "reply" }> => e.type === "prompt" || e.type === "reply");
  const changed = Object.entries(session.finalFiles ?? {}).filter(([p, s]) => session.task.files[p] !== s);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{session.task.title}</h1>
        <Tag tone="accent">AI-assisted round</Tag>
      </div>
      <p className="mt-1 text-sm text-muted" suppressHydrationWarning>
        {session.startedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {fmtClock(durationMs)} of {session.minutes} minutes ·{" "}
        {session.assistant === "claude" ? "Claude assistant" : "practice assistant"}
      </p>

      {!r ? (
        <ReportPending
          id={session.id}
          generate={generateAssistedReportAction}
          message={`Grading your round${usesClaude ? ": Claude is reviewing your prompts, code and explanation" : ""}…`}
        />
      ) : (
        <>
          <section className="card mt-6 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-md px-3 py-1 text-lg font-semibold ${SIGNAL_STYLE[r.hire.signal]}`}>{HIRE_LABELS[r.hire.signal]}</span>
              <span className="text-sm text-muted">{r.overall.toFixed(1)} / 4 overall</span>
              <span className="ml-auto text-xs text-muted">
                {r.generator === "claude" ? "Graded by Claude" : "Rule-based grading (set ANTHROPIC_API_KEY for Claude grading)"}
              </span>
            </div>
            <p className="mt-3">{r.summary}</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted">
              {r.hire.reasons.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </section>

          {r.focus.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Top focus areas</h2>
              <ol className="mt-2 grid gap-3 md:grid-cols-3">
                {r.focus.map((f, i) => (
                  <li key={i} className="card p-4">
                    <div className="text-xs text-muted">
                      {i + 1}. {ASSISTED_INFO[f.area].label}
                    </div>
                    <div className="mt-1 font-medium">{f.title}</div>
                    <p className="mt-1 text-sm text-muted">{f.why}</p>
                    <p className="mt-2 text-sm">
                      <span className="font-medium">Drill: </span>
                      {f.drill}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          )}

          <h2 className="mt-8 text-lg font-semibold">Bugs the assistant slipped in</h2>
          {r.bugs.length === 0 ? (
            <p className="mt-1 text-sm text-muted">None of the answers you got this time had a planted bug.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {r.bugs.map((b, i) => (
                <li key={i} className="card flex flex-wrap items-start gap-2 p-3 text-sm">
                  <Tag tone={OUTCOME[b.outcome].tone}>{OUTCOME[b.outcome].label}</Tag>
                  <div className="min-w-0 flex-1">
                    <div>
                      <span className="font-mono text-xs text-muted">{fmtClock(b.t)}</span> {b.description}
                    </div>
                    <div className="text-muted">{b.how}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-8 text-lg font-semibold">Rubric</h2>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {ASSISTED_RUBRIC.map((k) => (
              <div key={k} className="card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{ASSISTED_INFO[k].label}</span>
                  <span className="text-sm tabular-nums text-muted">{r.rubric[k].score} / 4</span>
                </div>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className={`h-1.5 flex-1 rounded ${n <= r.rubric[k].score ? SCORE_BAR[r.rubric[k].score] : "bg-surface-2"}`} />
                  ))}
                </div>
                <p className="mt-2 text-sm text-muted">{r.rubric[k].evidence}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-8 text-lg font-semibold">By the numbers</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Tests passing", `${r.tests.passed} / ${r.tests.total}`],
              ["Prompts", String(r.stats.prompts)],
              ["Test runs", String(r.stats.runs)],
              ["Pastes from the assistant", `${r.stats.pastesFromAssistant} of ${r.stats.pastes}`],
              ["New code from the assistant", r.aiShare === null ? "—" : `${Math.round(r.aiShare * 100)}%`],
            ].map(([label, value]) => (
              <div key={label} className="card p-3">
                <div className="text-xs text-muted">{label}</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
          {r.tests.failing.length > 0 && (
            <p className="mt-2 text-sm text-muted">Failing: {r.tests.failing.join("; ")}</p>
          )}

          {r.prompts.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Your prompts</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {r.prompts.map((p, i) => (
                  <li key={i} className="card p-3">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-xs leading-5 text-muted">{fmtClock(p.t)}</span>
                      <span className="flex-1 whitespace-pre-wrap">{p.text}</span>
                      <span className="tabular-nums text-muted">{p.score} / 4</span>
                    </div>
                    {p.notes.length > 0 && <p className="mt-1 text-muted">{p.notes.join(" ")}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {session.explanation && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Your explanation</h2>
          <p className="card mt-2 whitespace-pre-wrap p-4 text-sm">{session.explanation}</p>
        </>
      )}

      {changed.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-lg font-semibold">Your final code ({changed.map(([p]) => p).join(", ")})</summary>
          {changed.map(([p, s]) => (
            <div key={p} className="card mt-2 min-w-0 p-0">
              <div className="border-b border-line px-3 py-2 font-mono text-xs text-muted">{p}</div>
              <pre className="max-h-[50vh] overflow-auto p-3 font-mono text-xs">{s}</pre>
            </div>
          ))}
        </details>
      )}

      {chat.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-lg font-semibold">The full chat</summary>
          <div className="mt-2 space-y-3 text-sm">
            {chat.map((e, i) => (
              <div key={i} className={e.type === "prompt" ? "ml-8 rounded-lg bg-accent-soft p-3" : "mr-4 rounded-lg bg-surface-2 p-3"}>
                <div className="mb-1 text-xs text-muted">
                  {fmtClock(e.t)} · {e.type === "prompt" ? "You" : "Assistant"}
                  {e.type === "reply" && e.payload.planted && <span className="ml-2 font-medium text-bad">Planted bug: {e.payload.planted.description}</span>}
                </div>
                {e.type === "prompt" ? <p className="whitespace-pre-wrap">{e.payload.text}</p> : <Markdown text={e.payload.text} />}
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="mt-8 flex gap-2">
        <Link href="/assisted" className="btn-primary">
          Another round
        </Link>
        <Link href="/today" className="btn-secondary">
          Back to today
        </Link>
      </div>
    </main>
  );
}
