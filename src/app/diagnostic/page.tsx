import Link from "next/link";
import { Tag } from "@/components/badges";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import { RecordingConsent } from "@/components/RecordingConsent";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { getDiagnostic, type Diagnostic } from "@/lib/diagnostic";
import { DIAGNOSTIC_MINUTES, DIAGNOSTIC_MOCK, type DiagnosticResult } from "@/lib/diagnostic/plan";
import { RUBRIC, RUBRIC_INFO } from "@/lib/feedback/analyze";
import { fmtClock } from "@/lib/interview/timeline";
import { mockCapabilities } from "@/lib/mock";
import { getPrivacy } from "@/lib/privacy";
import { PATTERN_BY_ID } from "@/lib/problems/patterns";
import { finishDiagnosticAction, skipDiagnosticAction, startDiagnosticAction, startDiagnosticMockAction } from "./actions";

export default async function DiagnosticPage() {
  const { user } = await requireOnboardedUser();
  const [d, privacy] = await Promise.all([getDiagnostic(user.id), getPrivacy(user.id)]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      {!d?.completedAt && !d?.skipped && <OnboardingSteps current={2} />}
      <h1 className="text-2xl font-semibold">Starting diagnostic</h1>
      {!d || d.skipped ? (
        <Intro skipped={!!d?.skipped} />
      ) : d.completedAt && d.result ? (
        <Result result={d.result} />
      ) : (
        <Steps d={d} consented={privacy.recordingConsent} />
      )}
    </main>
  );
}

function Intro({ skipped }: { skipped: boolean }) {
  return (
    <>
      <p className="mt-1 text-muted">
        About {DIAGNOSTIC_MINUTES} minutes to find where your track should start, instead of starting everyone at the beginning.
      </p>
      <div className="card mt-6 space-y-2 p-4 text-sm">
        <p>
          <span className="font-medium">Three short problems</span> across core patterns, easy to medium. Aim for about eight minutes each, and
          give up when you&apos;re stuck: a miss tells the plan as much as a solve.
        </p>
        <p>
          <span className="font-medium">One {DIAGNOSTIC_MOCK.minutes}-minute voice mock</span> with a friendly interviewer. It sets a baseline for
          how you communicate: clarifying questions, explaining before coding, and talking through silences.
        </p>
        <p className="text-muted">
          Patterns the diagnostic doesn&apos;t test start from what it learned about the others. Your first real attempts refine everything.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={startDiagnosticAction}>
          <button className="btn-primary">{skipped ? "Take the diagnostic" : "Start"}</button>
        </form>
        {!skipped && (
          <form action={skipDiagnosticAction}>
            <button className="btn-secondary">Skip it, start from the beginning</button>
          </form>
        )}
        {skipped && (
          <Link href="/today" className="btn-secondary">
            Back to today
          </Link>
        )}
      </div>
    </>
  );
}

function Steps({ d, consented }: { d: Diagnostic; consented: boolean }) {
  const caps = mockCapabilities();
  const problemsDone = d.steps.every((s) => s.attempt);
  const mockDone = d.mock.reported;
  return (
    <>
      <p className="mt-1 text-muted">Do these in any order. Each one updates your plan as soon as it&apos;s saved.</p>
      <ol className="mt-6 space-y-3">
        {d.steps.map((s, i) => (
          <li key={s.slug}>
            <Link href={`/problems/${s.slug}?mode=learn&from=diagnostic`} className="card flex items-center gap-4 p-4 transition-colors hover:border-accent">
              <span className="w-5 text-sm text-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-muted">{PATTERN_BY_ID[s.pattern].name} · about 8 minutes</div>
              </div>
              {s.attempt ? <Tag tone={s.attempt.solved ? "good" : "warn"}>{s.attempt.solved ? "Solved" : "Attempted"}</Tag> : <Tag>To do</Tag>}
            </Link>
          </li>
        ))}
        <li className="card flex items-center gap-4 p-4">
          <span className="w-5 text-sm text-muted">{d.steps.length + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Voice mock: {d.mock.title}</div>
            <div className="text-xs text-muted">{DIAGNOSTIC_MOCK.minutes} minutes · friendly interviewer · hints allowed</div>
          </div>
          {mockDone ? (
            <Link href={`/mock/${d.mock.sessionId}`} className="text-sm text-accent hover:underline">
              <Tag tone="good">Done</Tag>
            </Link>
          ) : d.mock.sessionId ? (
            <Link href={`/mock/${d.mock.sessionId}`} className="btn-secondary">
              {d.mock.ended ? "See the report" : "Continue"}
            </Link>
          ) : consented ? (
            <form action={startDiagnosticMockAction}>
              <button className="btn-secondary">Start the mock</button>
            </form>
          ) : null}
        </li>
        {!d.mock.sessionId && !consented && (
          <li>
            <form action={startDiagnosticMockAction} className="space-y-3">
              <RecordingConsent claude={caps.interviewer === "claude"} livekit={caps.voice === "livekit"} />
              <button className="btn-secondary">Start the mock</button>
            </form>
          </li>
        )}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={finishDiagnosticAction}>
          <button className="btn-primary" disabled={!problemsDone}>
            {mockDone ? "See my starting point" : "Finish without the mock"}
          </button>
        </form>
        {!problemsDone && <span className="text-sm text-muted">Finish the three problems first.</span>}
        <form action={skipDiagnosticAction} className="ml-auto">
          <button className="btn-ghost text-sm">Skip the rest</button>
        </form>
      </div>
    </>
  );
}

function Result({ result }: { result: DiagnosticResult }) {
  const c = result.communication;
  return (
    <>
      <p className="mt-1 text-muted">Your track now starts from here. Every attempt keeps adjusting it.</p>

      <h2 className="mt-8 text-lg font-semibold">Patterns</h2>
      <ul className="mt-2 space-y-2">
        {result.problems.map((p) => {
          const delta = Math.round(p.after - p.before);
          return (
            <li key={p.slug} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="font-medium">{PATTERN_BY_ID[p.pattern].name}</span>
              <Tag tone={p.solved ? "good" : "warn"}>{p.solved ? "Solved" : "Missed"}</Tag>
              <span className="ml-auto tabular-nums text-muted">
                {Math.round(p.before)} → <strong className="text-ink">{Math.round(p.after)}</strong>{" "}
                <span className={delta >= 0 ? "text-good" : "text-bad"}>
                  ({delta >= 0 ? "+" : ""}
                  {delta})
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {result.priors.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          The {result.priors.length} patterns you haven&apos;t tried yet start at {result.priors[0].rating} instead of 1000, so the plan{" "}
          {result.priors[0].rating > 1000 ? "moves you along faster" : "starts gentler"}.
        </p>
      )}

      <h2 className="mt-8 text-lg font-semibold">Communication baseline</h2>
      {c ? (
        <>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {RUBRIC.map((k) => (
              <div key={k} className="card flex items-center justify-between p-3 text-sm">
                <span>{RUBRIC_INFO[k].label}</span>
                <span className="tabular-nums text-muted">{c.rubric[k]} / 4</span>
              </div>
            ))}
          </div>
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-muted">
            <li>{c.firstQuestionMs === null ? "No clarifying questions" : `First clarifying question at ${fmtClock(c.firstQuestionMs)}`}</li>
            <li>{c.approachBeforeCoding ? "Explained an approach before coding" : "Started coding before explaining an approach"}</li>
            <li>Longest silence: {fmtClock(c.longestSilenceMs)}</li>
            {c.wordsPerMinute !== null && (
              <li>
                {Math.round(c.wordsPerMinute)} words a minute, {c.fillersPer100Words.toFixed(1)} fillers per 100 words
              </li>
            )}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          You finished without the mock, so there&apos;s no baseline yet.{" "}
          <Link href="/mock" className="text-accent hover:underline">
            Do a mock interview
          </Link>{" "}
          when you&apos;re ready.
        </p>
      )}

      <Link href="/today?welcome=1" className="btn-primary mt-8 inline-block">
        See today&apos;s plan
      </Link>
    </>
  );
}
