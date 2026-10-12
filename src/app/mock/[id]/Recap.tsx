"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DifficultyBadge, Tag } from "@/components/badges";
import { fromStart, type FeedbackReport } from "@/lib/feedback/analyze";
import type { TrackChange } from "@/lib/feedback/track-update";
import { codeAt, fmtClock, sessionStats, transcript } from "@/lib/interview/timeline";
import type { InterviewerKind, MockConfig, SessionEvent, VoiceMode } from "@/lib/interview/types";
import type { Difficulty } from "@/lib/problems/types";
import { MockReportPending, ReportView } from "./Report";

interface Props {
  sessionId: string;
  /** Null until the report has been built. */
  report: { report: FeedbackReport; trackChanges: TrackChange[] } | null;
  /** Whether a new report will be graded by Claude. */
  usesClaude: boolean;
  title: string;
  patternName: string;
  difficulty: Difficulty;
  optimal: { time: string; space: string };
  companyName: string | null;
  config: MockConfig;
  voice: VoiceMode;
  interviewer: InterviewerKind;
  startedAt: string;
  durationMs: number;
  events: SessionEvent[];
}

/** After the interview: the feedback report, headline numbers and a scrubbable replay of code and transcript. */
export function Recap(props: Props) {
  const { events, durationMs } = props;
  // Headline numbers count from the Start press, like the report; the replay keeps the recording's clock.
  const fromStartPress = useMemo(() => fromStart(events, durationMs), [events, durationMs]);
  const stats = useMemo(() => sessionStats(fromStartPress.events, fromStartPress.durationMs), [fromStartPress]);
  const lines = useMemo(() => transcript(events), [events]);
  const runs = events.filter((e): e is Extract<SessionEvent, { type: "run" }> => e.type === "run");
  const [t, setT] = useState(durationMs);
  const code = useMemo(() => codeAt(events, t), [events, t]);

  const stat = (label: string, value: string) => (
    <div className="card p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
  const at = (ms: number | null) => (ms === null ? "—" : fmtClock(ms));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{props.title}</h1>
        <DifficultyBadge difficulty={props.difficulty} />
        <Tag tone="accent">{props.patternName}</Tag>
        {props.companyName && <Tag>{props.companyName} style</Tag>}
      </div>
      {/* The date is formatted in the viewer's locale and time zone, which the server can't know. */}
      <p className="mt-1 text-sm text-muted" suppressHydrationWarning>
        Mock interview on {new Date(props.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
        {fmtClock(fromStartPress.durationMs)} of {props.config.minutes} minutes · {props.config.persona} interviewer ·{" "}
        {props.interviewer === "claude" ? "Claude" : "scripted"}, {props.voice === "livekit" ? "LiveKit" : "browser"} voice
      </p>
      {props.report ? (
        <ReportView report={props.report.report} trackChanges={props.report.trackChanges} onJump={(t) => setT(t + (props.report?.report.startOffsetMs ?? 0))} />
      ) : (
        <MockReportPending sessionId={props.sessionId} usesClaude={props.usesClaude} />
      )}

      <h2 className="mt-8 text-lg font-semibold">By the numbers</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("First spoke at", at(stats.firstSpokeMs))}
        {stat("First test run", at(stats.firstRunMs))}
        {stat("All tests passed at", at(stats.acceptedMs))}
        {stat("Runs (failed)", `${stats.runs} (${stats.failedRuns})`)}
        {stat("Your turns", String(stats.candidateTurns))}
        {stat("Words spoken", String(stats.candidateWords))}
        {stat("Longest silence", stats.longestSilence ? fmtClock(stats.longestSilence.ms) : "—")}
        {stat("Optimal", props.optimal.time)}
      </div>

      <h2 id="replay" className="mt-8 scroll-mt-20 text-lg font-semibold">
        Replay
      </h2>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="range"
          className="flex-1"
          min={0}
          max={durationMs}
          step={1000}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          aria-label="Replay position"
        />
        <span className="w-24 text-right font-mono text-sm tabular-nums">
          {fmtClock(t)} / {fmtClock(durationMs)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {runs.map((r, i) => (
          <button
            key={i}
            onClick={() => setT(r.t)}
            className={`rounded px-2 py-0.5 text-xs ${r.payload.verdict === "accepted" ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}
          >
            {r.payload.scope === "all" ? "Submit" : "Run"} at {fmtClock(r.t)} · {r.payload.passed}/{r.payload.total}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card min-w-0 p-0">
          <div className="border-b border-line px-3 py-2 text-xs text-muted">
            Code at {fmtClock(t)} {code.language ? `(${code.language})` : ""}
          </div>
          <pre className="max-h-[60vh] overflow-auto p-3 font-mono text-xs">{code.code || "(no code yet)"}</pre>
        </div>
        <div className="card max-h-[66vh] overflow-y-auto p-3 text-sm">
          {lines.length === 0 && <p className="text-muted">Nothing was said.</p>}
          <ul className="space-y-2">
            {lines.map((l, i) => (
              <li key={i} className={l.t > t ? "opacity-40" : ""}>
                <button className="mr-2 font-mono text-xs text-muted hover:underline" onClick={() => setT(l.t)}>
                  {fmtClock(l.t)}
                </button>
                <span className="font-medium">{l.speaker === "interviewer" ? "Interviewer" : "You"}:</span> {l.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 flex gap-2">
        <Link href="/mock" className="btn-primary">
          New mock interview
        </Link>
        <Link href="/today" className="btn-secondary">
          Back to today
        </Link>
      </div>
    </main>
  );
}
