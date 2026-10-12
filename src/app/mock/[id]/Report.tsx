"use client";
import Link from "next/link";
import { Tag } from "@/components/badges";
import { ReportPending } from "@/components/ReportPending";
import { HIRE_LABELS, RUBRIC, RUBRIC_INFO, type FeedbackReport, type HireSignal, type Moment } from "@/lib/feedback/analyze";
import type { TrackChange } from "@/lib/feedback/track-update";
import { fmtClock } from "@/lib/interview/timeline";
import { PATTERN_BY_ID } from "@/lib/problems/patterns";
import { generateReportAction } from "../actions";

const SIGNAL_TONE: Record<HireSignal, "good" | "warn" | "bad"> = {
  "strong-hire": "good",
  hire: "good",
  "lean-hire": "warn",
  no: "bad",
  "strong-no": "bad",
};

const SCORE_LABEL = ["", "Well below the bar", "Below the bar", "Meets the bar", "Strong"];
const SCORE_BAR = ["", "bg-bad", "bg-warn", "bg-good", "bg-good"];

export function MockReportPending({ sessionId, usesClaude }: { sessionId: string; usesClaude: boolean }) {
  return (
    <ReportPending
      id={sessionId}
      generate={generateReportAction}
      message={`Building your feedback report${usesClaude ? ": Claude is reviewing the code timeline and transcript" : ""}…`}
    />
  );
}

export function ReportView({
  report,
  trackChanges,
  onJump,
}: {
  report: FeedbackReport;
  trackChanges: TrackChange[];
  onJump: (t: number) => void;
}) {
  const c = report.communication;
  const metric = (label: string, value: string, tone?: "good" | "warn", help?: string) => (
    <div className="card p-3" title={help}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${tone === "warn" ? "text-warn" : tone === "good" ? "text-good" : ""}`}>{value}</div>
    </div>
  );
  const yesNo = (v: boolean | null) => (v === null ? "—" : v ? "Yes" : "No");

  return (
    <section className="mt-6">
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-md px-3 py-1 text-lg font-semibold ${
              { good: "bg-good-soft text-good", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad" }[SIGNAL_TONE[report.hire.signal]]
            }`}
          >
            {HIRE_LABELS[report.hire.signal]}
          </span>
          <span className="text-sm text-muted">
            {report.overall.toFixed(1)} / 4 overall · {report.hire.bar}
          </span>
          <span className="ml-auto text-xs text-muted">
            {report.generator === "claude" ? "Graded by Claude" : "Rule-based grading (set ANTHROPIC_API_KEY for Claude grading)"}
          </span>
        </div>
        <p className="mt-3">{report.summary}</p>
        {report.hire.reasons.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted">
            {report.hire.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      {report.focus.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Top focus areas</h2>
          <ol className="mt-2 grid gap-3 md:grid-cols-3">
            {report.focus.map((f, i) => (
              <li key={i} className="card p-4">
                <div className="text-xs text-muted">
                  {i + 1}. {RUBRIC_INFO[f.area].label}
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

      {trackChanges.length > 0 && (
        <div className="card mt-4 border-accent p-4 text-sm">
          <div className="font-medium">Added to your plan</div>
          <ul className="mt-1 space-y-1">
            {trackChanges.map((ch, i) =>
              ch.kind === "rating" ? (
                <li key={i}>
                  {PATTERN_BY_ID[ch.pattern].name} rating {Math.round(ch.before)} → {Math.round(ch.after)}, so more{" "}
                  {PATTERN_BY_ID[ch.pattern].name} practice comes up.{" "}
                  <Link href={`/problems#${ch.pattern}`} className="text-accent hover:underline">
                    See the pattern
                  </Link>
                </li>
              ) : (
                <li key={i}>
                  {ch.title} is due today as a re-solve.{" "}
                  <Link href="/today" className="text-accent hover:underline">
                    Open today&apos;s plan
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold">Rubric</h2>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        {RUBRIC.map((k) => {
          const r = report.rubric[k];
          return (
            <div key={k} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{RUBRIC_INFO[k].label}</span>
                <span className="text-sm tabular-nums text-muted">{r.score} / 4</span>
              </div>
              <div className="mt-2 flex gap-1" aria-label={SCORE_LABEL[r.score]}>
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className={`h-1.5 flex-1 rounded ${n <= r.score ? SCORE_BAR[r.score] : "bg-surface-2"}`} />
                ))}
              </div>
              <p className="mt-2 text-sm text-muted">{r.evidence}</p>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 text-lg font-semibold">Communication under pressure</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metric("First clarifying question", c.firstQuestionMs === null ? "None" : fmtClock(c.firstQuestionMs), c.firstQuestionMs === null ? "warn" : undefined)}
        {metric("Approach before coding", yesNo(c.approachBeforeCoding), c.approachBeforeCoding ? "good" : "warn")}
        {metric("Narrated while debugging", yesNo(c.narratedDebugging), c.narratedDebugging === false ? "warn" : c.narratedDebugging ? "good" : undefined)}
        {metric(
          "Silent stretches over 45s",
          String(c.silentStretches.length),
          c.silentStretches.length > 2 ? "warn" : undefined,
          c.longestSilenceMs ? `Longest ${fmtClock(c.longestSilenceMs)}` : undefined,
        )}
        {metric(
          "Filler words per 100",
          c.spoken ? String(c.fillersPer100Words) : "—",
          c.spoken && c.fillersPer100Words > 6 ? "warn" : undefined,
          c.topFillers.map((f) => `${f.word} ×${f.count}`).join(", ") || undefined,
        )}
        {metric("Speaking pace", c.wordsPerMinute === null ? "—" : `${c.wordsPerMinute} wpm`, c.wordsPerMinute !== null && (c.wordsPerMinute > 190 || c.wordsPerMinute < 90) ? "warn" : undefined)}
        {metric("Share of talking", `${Math.round(c.talkShare * 100)}%`, c.talkShare < 0.35 ? "warn" : undefined)}
        {metric("Complexity stated", c.complexityStated ?? "Never", c.complexityVerdict === 0 ? "good" : "warn")}
      </div>
      {c.spoken && (
        <p className="mt-2 text-xs text-muted">Speech recognition often drops filler words, so the real filler rate is likely a little higher.</p>
      )}

      {report.moments.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Key moments</h2>
          <p className="text-sm text-muted">Click one to jump the replay below to that moment.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {report.moments.map((m, i) => (
              <MomentRow key={i} m={m} onJump={onJump} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function MomentRow({ m, onJump }: { m: Moment; onJump: (t: number) => void }) {
  return (
    <li>
      <button
        className="flex w-full items-start gap-2 rounded px-2 py-1 text-left hover:bg-surface-2"
        onClick={() => {
          onJump(m.t);
          document.getElementById("replay")?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <span className="w-12 shrink-0 font-mono text-xs leading-5 text-muted">{fmtClock(m.t)}</span>
        <Tag tone={m.tone === "good" ? "good" : m.tone === "warn" ? "warn" : "neutral"}>
          {m.tone === "good" ? "Good" : m.tone === "warn" ? "Watch" : "Note"}
        </Tag>
        <span>{m.text}</span>
      </button>
    </li>
  );
}
