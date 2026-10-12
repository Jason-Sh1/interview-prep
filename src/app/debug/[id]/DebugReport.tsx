import Link from "next/link";
import { Tag } from "@/components/badges";
import { ReportPending } from "@/components/ReportPending";
import type { DebugRound } from "@/lib/comprehension";
import { DEBUG_INFO, DEBUG_RUBRIC } from "@/lib/comprehension/grade";
import { HIRE_LABELS, type HireSignal } from "@/lib/feedback/analyze";
import { fmtClock } from "@/lib/interview/timeline";
import { generateDebugReportAction } from "../actions";

const SIGNAL_STYLE: Record<HireSignal, string> = {
  "strong-hire": "bg-good-soft text-good",
  hire: "bg-good-soft text-good",
  "lean-hire": "bg-warn-soft text-warn",
  no: "bg-bad-soft text-bad",
  "strong-no": "bg-bad-soft text-bad",
};
const SCORE_BAR = ["", "bg-bad", "bg-warn", "bg-good", "bg-good"];

export function DebugReportView({ round, usesClaude }: { round: DebugRound; usesClaude: boolean }) {
  const r = round.report;
  const durationMs = (round.endedAt ?? round.startedAt).getTime() - round.startedAt.getTime();
  const changed = Object.entries(round.files).filter(([p, s]) => round.task.files[p] !== s);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{round.task.title}</h1>
        <Tag tone="accent">Comprehension and debugging</Tag>
      </div>
      <p className="mt-1 text-sm text-muted" suppressHydrationWarning>
        {round.startedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {fmtClock(durationMs)} of {round.minutes} minutes ·{" "}
        {round.assistant === "none" ? "no assistant" : round.assistant === "claude" ? "Claude assistant" : "offline helper"}
      </p>

      {!r ? (
        <ReportPending
          id={round.id}
          generate={generateDebugReportAction}
          message={`Grading your round${usesClaude ? ": Claude is reading your answers and write-up" : ""}…`}
        />
      ) : (
        <>
          <section className="card mt-6 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-md px-3 py-1 text-lg font-semibold ${SIGNAL_STYLE[r.hire.signal]}`}>{HIRE_LABELS[r.hire.signal]}</span>
              <span className="text-sm text-muted">{r.overall.toFixed(1)} / 4 overall</span>
              <span className="ml-auto text-xs text-muted">
                {r.generator === "claude" ? "Written answers graded by Claude" : "Rule-based grading (set ANTHROPIC_API_KEY for Claude grading)"}
              </span>
            </div>
            <p className="mt-3">{r.summary}</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted">
              {r.hire.reasons.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </section>

          <h2 className="mt-8 text-lg font-semibold">The bugs</h2>
          <ul className="mt-2 space-y-2">
            {r.bugs.map((b) => (
              <li key={b.id} className="card p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted">{b.file}</span>
                  <Tag tone={b.fixed ? "good" : "bad"}>{b.fixed ? "Fixed" : "Still there"}</Tag>
                  {b.fixed && !b.explained && <Tag tone="warn">Not explained</Tag>}
                </div>
                <p className="mt-2">{b.description}</p>
              </li>
            ))}
          </ul>
          {r.regressions.length > 0 && (
            <div className="card mt-3 border-bad bg-bad-soft p-3 text-sm">
              <div className="font-medium">These tests passed before and fail now</div>
              <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                {r.regressions.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          {r.focus.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Top focus areas</h2>
              <ol className="mt-2 grid gap-3 md:grid-cols-3">
                {r.focus.map((f, i) => (
                  <li key={i} className="card p-4">
                    <div className="text-xs text-muted">
                      {i + 1}. {DEBUG_INFO[f.area].label}
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

          <h2 className="mt-8 text-lg font-semibold">Rubric</h2>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {DEBUG_RUBRIC.map((k) => {
              const s = r.rubric[k];
              return (
                <div key={k} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{DEBUG_INFO[k].label}</span>
                    <span className="text-sm tabular-nums text-muted">{s.score} / 4</span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className={`h-1.5 flex-1 rounded ${n <= s.score ? SCORE_BAR[s.score] : "bg-surface-2"}`} />
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-muted">{s.evidence}</p>
                </div>
              );
            })}
          </div>

          <h2 className="mt-8 text-lg font-semibold">Your answers</h2>
          <div className="mt-2 space-y-3">
            {r.questions.map((q) => (
              <div key={q.id} className="card p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{q.prompt}</span>
                  <span className="shrink-0 tabular-nums text-muted">{q.score} / 4</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap">{q.yours || <span className="text-muted">No answer.</span>}</p>
                {q.note && <p className="mt-2 text-muted">{q.note}</p>}
                <p className="mt-2 text-muted">
                  <span className="font-medium text-ink">A strong answer: </span>
                  {q.model}
                </p>
              </div>
            ))}
          </div>

          <h2 className="mt-8 text-lg font-semibold">By the numbers</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Full suite" value={`${r.tests.passed}/${r.tests.total}`} />
            <Stat label="Test runs" value={String(r.stats.runs)} />
            <Stat label="First run at" value={r.stats.firstRunMs === null ? "—" : fmtClock(r.stats.firstRunMs)} />
            <Stat label={r.stats.withAssistant ? "Questions to the assistant" : "Tests you added"} value={String(r.stats.withAssistant ? r.stats.prompts : r.testsAdded)} />
          </div>

          {changed.length > 0 && (
            <details className="mt-8">
              <summary className="cursor-pointer text-lg font-semibold">Your final code ({changed.length} files changed)</summary>
              {changed.map(([path, src]) => (
                <div key={path} className="mt-3">
                  <div className="font-mono text-xs text-muted">{path}</div>
                  <pre className="mt-1 overflow-x-auto rounded-md bg-surface-2 p-3 text-xs">{src}</pre>
                </div>
              ))}
            </details>
          )}

          <p className="mt-8 text-sm">
            <Link href="/debug" className="text-accent hover:underline">
              Try another codebase
            </Link>
          </p>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
