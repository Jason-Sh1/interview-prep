"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Tag } from "@/components/badges";
import { competencyLabel } from "@/lib/behavioral/competencies";
import type { BehavioralExtra, QuestionResult } from "@/lib/behavioral/grade";
import { STAR_PARTS } from "@/lib/behavioral/star";
import { fmtClock } from "@/lib/interview/timeline";
import { saveAnswerAsStoryAction } from "../actions";

const PART_LABEL = { situation: "Situation", task: "Task", action: "Action", result: "Result" } as const;
const LENGTH_LABEL = { short: "Too short", ok: "Good length", long: "Long" } as const;

function SaveButton({ roundId, questionId }: { roundId: string; questionId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ id?: number; error?: string } | null>(null);
  if (state?.id)
    return (
      <Link href={`/behavioral/stories?edit=${state.id}#story-${state.id}`} className="text-sm text-accent hover:underline">
        Saved. Edit it in the story bank →
      </Link>
    );
  return (
    <span className="text-sm">
      <button type="button" className="btn-secondary" disabled={pending} onClick={() => start(async () => setState(await saveAnswerAsStoryAction(roundId, questionId)))}>
        {pending ? "Saving…" : "Save to story bank"}
      </button>
      {state?.error && <span className="ml-2 text-bad">{state.error}</span>}
    </span>
  );
}

function QuestionCard({ q, i, roundId }: { q: QuestionResult; i: number; roundId: string }) {
  if (q.t === null)
    return (
      <li className="card p-4 text-sm text-muted">
        <span className="font-medium">Q{i + 1}.</span> {q.text} <span className="italic">(not reached)</span>
      </li>
    );
  const s = q.star;
  return (
    <li className="card p-4 text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-xs text-muted">{fmtClock(q.t)}</span>
        <span className="font-medium">
          Q{i + 1}. {q.text}
        </span>
        {s && <span className="ml-auto text-xs tabular-nums text-muted">{s.score} / 4</span>}
      </div>
      {!s ? (
        <p className="mt-2 text-bad">No answer.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STAR_PARTS.map((p) => (
              <Tag key={p} tone={s.parts[p] ? "good" : "bad"}>
                {s.parts[p] ? "✓" : "✗"} {PART_LABEL[p]}
              </Tag>
            ))}
            <Tag tone={s.hasMetric ? "good" : "warn"}>{s.hasMetric ? "Has numbers" : "No numbers"}</Tag>
            <Tag tone={s.iRatio >= 0.55 ? "good" : "warn"}>&quot;I&quot; {Math.round(s.iRatio * 100)}%</Tag>
            <Tag tone={s.reflection ? "good" : "neutral"}>{s.reflection ? "Reflected" : "No reflection"}</Tag>
            <Tag tone={s.length === "ok" ? "good" : "warn"}>
              {LENGTH_LABEL[s.length]} ({s.words} words)
            </Tag>
            {q.followUps > 0 && <Tag>{q.followUps} follow-up{q.followUps === 1 ? "" : "s"}</Tag>}
          </div>
          {q.gaps.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted">
              {q.gaps.slice(0, 3).map((g) => (
                <li key={g.gap}>{g.text}</li>
              ))}
            </ul>
          )}
          {(q.principles.length > 0 || s.shows.length > 0) && (
            <p className="mt-2 text-xs">
              {q.principles.length > 0 && (
                <>
                  <span className="font-medium">Principles shown: </span>
                  {q.principles.join(", ")}.{" "}
                </>
              )}
              {s.shows.length > 0 && <span className="text-muted">Competencies heard: {s.shows.map(competencyLabel).join(", ")}.</span>}
            </p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted">Your answer</summary>
            <p className="mt-1 whitespace-pre-wrap">{q.answer}</p>
          </details>
          <div className="mt-2">
            <SaveButton roundId={roundId} questionId={q.id} />
          </div>
        </>
      )}
    </li>
  );
}

/** The behavioral part of the report: STAR results per question and the principles shown. */
export function BehavioralReportSection({ roundId, extra, companyName }: { roundId: string; extra?: Record<string, unknown>; companyName: string | null }) {
  const x = extra as BehavioralExtra | undefined;
  if (!x?.questions) return null;
  return (
    <>
      <h2 className="mt-8 text-lg font-semibold">Your answers</h2>
      <ol className="mt-2 space-y-3">
        {x.questions.map((q, i) => (
          <QuestionCard key={q.id} q={q} i={i} roundId={roundId} />
        ))}
      </ol>
      {x.principles.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">
            {companyName ? `${companyName} ` : ""}
            {x.principlesLabel}
          </h2>
          <div className="card mt-2 flex flex-wrap gap-1.5 p-4">
            {x.principles.map((p) => (
              <Tag key={p.id} tone={p.shown ? "good" : "neutral"}>
                {p.shown ? "✓ " : ""}
                {p.name}
              </Tag>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            Green ones came through in at least one answer. Check the{" "}
            <Link href={`/behavioral/stories?company=${x.company}`} className="text-accent hover:underline">
              story bank coverage
            </Link>{" "}
            for stories that fill the rest.
          </p>
        </>
      )}
    </>
  );
}
