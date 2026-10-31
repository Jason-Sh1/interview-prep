import Link from "next/link";
import { Tag } from "@/components/badges";
import { ReportPending } from "@/components/ReportPending";
import { HIRE_LABELS, type HireSignal } from "@/lib/feedback/analyze";
import { fmtClock } from "@/lib/interview/timeline";
import type { Round } from "@/lib/rounds";
import type { RoundKindDef } from "@/lib/rounds/kind";
import { ROUND_INFO } from "@/lib/rounds/types";

const SIGNAL_STYLE: Record<HireSignal, string> = {
  "strong-hire": "bg-good-soft text-good",
  hire: "bg-good-soft text-good",
  "lean-hire": "bg-warn-soft text-warn",
  no: "bg-bad-soft text-bad",
  "strong-no": "bg-bad-soft text-bad",
};
const SCORE_BAR = ["", "bg-bad", "bg-warn", "bg-good", "bg-good"];
const TONE: Record<string, string> = { good: "text-good", warn: "text-warn", info: "text-muted" };

/**
 * The report page shared by conversation rounds: signal, summary, checks,
 * focus areas, rubric and transcript. `children` holds the kind's own section
 * (the whiteboard, STAR results, the code).
 */
export function RoundReportView({
  round,
  def,
  title,
  usesClaude,
  generate,
  children,
}: {
  round: Round;
  def: RoundKindDef;
  title: string;
  usesClaude: boolean;
  generate: (id: string) => Promise<void>;
  children?: React.ReactNode;
}) {
  const r = round.report;
  const info = ROUND_INFO[round.kind];
  const durationMs = round.startedAt && round.endedAt ? round.endedAt.getTime() - round.startedAt.getTime() : 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <Tag tone="accent">{info.label}</Tag>
      </div>
      <p className="mt-1 text-sm text-muted" suppressHydrationWarning>
        {round.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {fmtClock(durationMs)} of {round.config.minutes} minutes ·{" "}
        {round.interviewer === "claude" ? "Claude interviewer" : "scripted interviewer"}
      </p>

      {!r ? (
        <ReportPending id={round.id} generate={generate} message={`Building your report${usesClaude ? ": Claude is reading the conversation" : ""}…`} />
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
            {r.strengths.length > 0 && (
              <div className="mt-3 text-sm">
                <span className="font-medium">Strengths: </span>
                {r.strengths.join(" · ")}
              </div>
            )}
          </section>

          {r.focus.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Top focus areas</h2>
              <ol className="mt-2 grid gap-3 md:grid-cols-3">
                {r.focus.map((f, i) => (
                  <li key={i} className="card p-4">
                    <div className="text-xs text-muted">
                      {i + 1}. {def.rubricInfo[f.area]?.label ?? f.area}
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

          {r.checks.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Checklist</h2>
              <ul className="card mt-2 grid gap-x-6 gap-y-1 p-4 text-sm sm:grid-cols-2">
                {r.checks.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={c.ok ? "text-good" : "text-bad"} aria-label={c.ok ? "yes" : "no"}>
                      {c.ok ? "✓" : "✗"}
                    </span>
                    <span>
                      {c.label}
                      {c.detail && <span className="text-muted"> ({c.detail})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {children}

          <h2 className="mt-8 text-lg font-semibold">Rubric</h2>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {def.rubric.map((k) => {
              const s = r.rubric[k];
              if (!s) return null;
              return (
                <div key={k} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium" title={def.rubricInfo[k].help}>
                      {def.rubricInfo[k].label}
                    </span>
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

          {r.moments.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">Key moments</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {r.moments.map((m, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-12 shrink-0 font-mono text-xs text-muted">{fmtClock(m.t)}</span>
                    <span className={TONE[m.tone]}>{m.text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <details className="mt-8">
        <summary className="cursor-pointer text-lg font-semibold">Transcript</summary>
        {round.transcript.length ? (
          <ul className="mt-2 space-y-2 text-sm">
            {round.transcript.map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-12 shrink-0 font-mono text-xs text-muted">{fmtClock(t.t)}</span>
                <span>
                  <span className="font-medium">{t.speaker === "candidate" ? "You" : "Interviewer"}: </span>
                  {t.text}
                  {t.interrupted && <span className="text-muted"> (cut off)</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Nothing was said.</p>
        )}
      </details>

      <div className="mt-10 flex gap-3">
        <Link href={info.path} className="btn-primary">
          Another {info.label.toLowerCase()} round
        </Link>
        <Link href="/today" className="btn-secondary">
          Back to Today
        </Link>
      </div>
    </main>
  );
}
