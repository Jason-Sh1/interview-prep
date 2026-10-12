"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { recordAttemptAction } from "@/app/actions";
import { DifficultyBadge, Tag } from "@/components/badges";
import { Editor, useDarkMode } from "@/components/CodeEditor";
import { Markdown } from "@/components/Markdown";
import { ResultsPanel } from "@/components/RunResults";
import { CONFIDENCE_LABELS, type Confidence } from "@/lib/engine/fsrs";
import type { PlanItem } from "@/lib/engine/planner";
import type { PublicProblem } from "@/lib/problems/public";
import type { PatternId, TestCase } from "@/lib/problems/types";
import { preloadPython, runInBrowser } from "@/lib/runner/browser";
import type { RunOutcome } from "@/lib/runner/compare";
import { LANGUAGES, toSnakeCase, type Language } from "@/lib/runner/drivers";
import type { AttemptResult } from "@/lib/track";

export type WorkspaceMode = "learn" | "review" | "mixed";

interface Props {
  problem: PublicProblem;
  patternName: string;
  patternChoices: { id: PatternId; name: string }[];
  mode: WorkspaceMode;
  samples: TestCase[];
  allTests: TestCase[] | null;
  runner: "browser" | "judge0";
  starters: Record<Language, string>;
  defaultLanguage: Language;
  complexityChoices: string[];
  previousAttempts: number;
  solvedBefore: boolean;
  /** An open drill from mock feedback that points at this problem. */
  drill?: { title: string; drill: string } | null;
  /** Set when this review is an AI-written variant of the problem. */
  variant?: { id: number; twist: string; originalTitle: string } | null;
  /** Set when opened from the onboarding diagnostic: which problem of how many. */
  diagnostic?: { step: number; total: number } | null;
}

type Stage = "solving" | "explaining" | "checkin" | "done";

const HINT_NAMES = ["Nudge", "Approach", "Pseudocode"];
const EXPLAIN_SECONDS = 120;

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function fmtValue(v: unknown): string {
  return JSON.stringify(v);
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export function Workspace(props: Props) {
  const { problem, mode, samples, runner } = props;
  const sig = problem.signature;
  const dark = useDarkMode();
  const startedAt = useRef(new Date());
  const [elapsed, setElapsed] = useState(0);
  const [lang, setLang] = useState<Language>(props.defaultLanguage);
  const [codeByLang, setCodeByLang] = useState<Record<Language, string>>(props.starters);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [running, setRunning] = useState<null | "run" | "submit">(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [stage, setStage] = useState<Stage>("solving");
  const [explainLeft, setExplainLeft] = useState(EXPLAIN_SECONDS);
  const stats = useRef({ runCount: 0, failedRuns: 0, firstRun: null as number | null, accepted: null as number | null, labels: new Set<string>() });
  const [complexity, setComplexity] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [patternGuess, setPatternGuess] = useState<string>("");
  const [gaveUp, setGaveUp] = useState(false);
  const [acceptedAfter, setAcceptedAfter] = useState<number | null>(null);
  const [saved, setSaved] = useState<{ result: AttemptResult; next: PlanItem | null } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const finished = stage === "done";
  const showPattern = mode !== "mixed" || finished;

  // Restore saved drafts and the last language for this problem. Reviews and
  // mixed practice keep their own drafts, so they never open on old code.
  // A variant has its own signature, so it keeps its own drafts too.
  const draftId = props.variant ? `${problem.slug}~v${props.variant.id}` : problem.slug;
  const draftKey = (l: Language, m: WorkspaceMode = mode) => (m === "learn" ? `draft:${draftId}:${l}` : `draft:${m}:${draftId}:${l}`);
  useEffect(() => {
    const restored = { ...props.starters };
    for (const l of LANGUAGES) {
      const d = storageGet(draftKey(l.id));
      if (d) restored[l.id] = d;
    }
    // Drafts live in localStorage, which is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCodeByLang(restored);
    const last = storageGet(`lang:${problem.slug}`) as Language | null;
    if (last && restored[last] !== undefined) setLang(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  useEffect(() => {
    if (lang === "python" && runner === "browser") preloadPython();
  }, [lang, runner]);

  useEffect(() => {
    if (stage === "done" || stage === "checkin") return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current.getTime()) / 1000));
      if (stage === "explaining") setExplainLeft((x) => Math.max(0, x - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [stage]);

  const code = codeByLang[lang];
  const setCode = (v: string) => {
    setCodeByLang((c) => ({ ...c, [lang]: v }));
    storageSet(draftKey(lang), v);
  };

  const secondsSinceStart = () => Math.round((Date.now() - startedAt.current.getTime()) / 1000);

  const execute = useCallback(
    async (scope: "sample" | "all") => {
      setRunning(scope === "sample" ? "run" : "submit");
      const s = stats.current;
      s.runCount++;
      if (s.firstRun === null) s.firstRun = secondsSinceStart();
      let res: RunOutcome;
      try {
        if (runner === "judge0") {
          const r = await fetch("/api/run", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ slug: problem.slug, language: lang, code, scope, ...(props.variant ? { variantId: props.variant.id } : {}) }),
          });
          res = r.ok
            ? await r.json()
            : { verdict: "internal_error", results: [], passed: 0, total: 0, message: (await r.json()).error, runner: "judge0" };
        } else {
          res = await runInBrowser(sig, lang, code, scope === "sample" ? samples : props.allTests!);
        }
      } catch (e) {
        res = { verdict: "internal_error", results: [], passed: 0, total: 0, message: String(e), runner };
      }
      if (res.verdict !== "accepted") {
        s.failedRuns++;
        for (const r of res.results) if (!r.passed && r.label) s.labels.add(r.label);
      }
      setOutcome(res);
      setRunning(null);
      if (scope === "all" && res.verdict === "accepted") {
        s.accepted = secondsSinceStart();
        setAcceptedAfter(s.accepted);
        setStage("checkin");
      }
    },
    [runner, problem.slug, lang, code, sig, samples, props.allTests, props.variant],
  );

  function save(opts: { solved: boolean; gaveUp: boolean; confidence: Confidence | null; complexity: string | null; explained?: boolean }) {
    const s = stats.current;
    setSaveError(null);
    startSaving(async () => {
      try {
        const res = await recordAttemptAction({
          slug: problem.slug,
          mode,
          language: lang,
          solved: opts.solved,
          gaveUp: opts.gaveUp,
          startedAt: startedAt.current.toISOString(),
          secondsToFirstRun: s.firstRun,
          secondsToAccepted: opts.solved ? (s.accepted ?? secondsSinceStart()) : null,
          runCount: s.runCount,
          failedRuns: s.failedRuns,
          failingLabels: [...s.labels],
          hintsUsed,
          confidence: opts.confidence,
          complexityChoice: opts.complexity,
          code: opts.explained ? null : code,
          variantId: props.variant?.id ?? null,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        setSaved(res);
        setStage("done");
        // A solved problem's drafts would hand the next review the answer.
        if (opts.solved) for (const m of ["learn", "review", "mixed"] as const) for (const l of LANGUAGES) storageRemove(draftKey(l.id, m));
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  const nextHref = (item: PlanItem) =>
    `/problems/${item.slug}?mode=${item.kind === "review" ? "review" : item.kind === "mixed" ? "mixed" : "learn"}`;

  const visibleHints = finished ? 3 : hintsUsed;

  const examples = useMemo(
    () =>
      samples.map((t, i) => {
        if (sig.kind === "function") {
          const names = sig.params.map((p) => (lang === "python" ? toSnakeCase(p.name) : p.name));
          return {
            input: t.input.map((v, j) => `${names[j]} = ${fmtValue(v)}`).join(", "),
            output: fmtValue(t.expected),
            key: i,
          };
        }
        return { input: `${fmtValue(t.input[0])}\n${fmtValue(t.input[1])}`, output: fmtValue(t.expected), key: i };
      }),
    [samples, sig, lang],
  );

  return (
    <div className="grid flex-1 grid-cols-1 lg:h-[calc(100vh-3.5rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Left: statement, hints, check-in */}
      <section className="overflow-y-auto border-line p-5 lg:border-r">
        <div className="flex flex-wrap items-center gap-2">
          {mode === "review" && <Tag tone="good">Review</Tag>}
          {mode === "mixed" && <Tag>Mixed practice</Tag>}
          <DifficultyBadge difficulty={problem.difficulty} />
          {showPattern ? <Tag tone="accent">{props.patternName}</Tag> : <Tag>Pattern hidden</Tag>}
          {mode === "learn" && stage === "solving" && (
            <Link href={`/mock?problem=${problem.slug}`} className="ml-auto text-xs text-accent hover:underline">
              Do it as a mock interview
            </Link>
          )}
        </div>
        <h1 className="mt-2 text-xl font-semibold">{problem.title}</h1>
        {props.variant && (
          <div className="card mt-3 border-accent bg-accent-soft p-3 text-sm">
            <span className="font-medium">A twist on {props.variant.originalTitle}.</span> {props.variant.twist}{" "}
            {stage === "solving" && (
              <Link href={`/problems/${problem.slug}?mode=review&original=1`} className="text-accent underline">
                Review the original instead
              </Link>
            )}
          </div>
        )}
        {props.diagnostic && stage === "solving" && (
          <div className="card mt-3 border-accent bg-accent-soft p-3 text-sm">
            <span className="font-medium">
              Diagnostic, problem {props.diagnostic.step} of {props.diagnostic.total}.
            </span>{" "}
            Aim for about eight minutes, and give up when you&apos;re stuck: a miss tells the plan as much as a solve.
          </div>
        )}
        {props.drill && stage === "solving" && (
          <div className="card mt-3 border-warn bg-warn-soft p-3 text-sm">
            <span className="font-medium">Drill from your mock: {props.drill.title}.</span> {props.drill.drill}
          </div>
        )}
        {mode === "review" && stage === "solving" && (
          <div className="card mt-3 bg-good-soft p-3 text-sm">
            Review: re-implement it against the clock, or{" "}
            <button className="font-medium text-good underline" onClick={() => setStage("explaining")}>
              explain the approach out loud in 2 minutes
            </button>{" "}
            instead.
          </div>
        )}
        <Markdown text={problem.statement} className="mt-3 text-sm" />

        <div className="mt-4 space-y-2">
          {examples.map((ex) => (
            <div key={ex.key} className="rounded-md bg-surface-2 p-3 font-mono text-xs">
              <div className="whitespace-pre-wrap">
                <span className="text-muted">Input: </span>
                {ex.input}
              </div>
              <div>
                <span className="text-muted">Output: </span>
                {ex.output}
              </div>
            </div>
          ))}
        </div>

        {problem.constraints.length > 0 && (
          <>
            <h2 className="mt-5 text-sm font-medium">Constraints</h2>
            <ul className="mt-1 list-disc pl-5 font-mono text-xs text-muted">
              {problem.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </>
        )}

        {/* Hints: retrieval before reveal */}
        <div className="mt-6">
          <h2 className="text-sm font-medium">Hints</h2>
          {stage !== "done" && hintsUsed === 0 && (
            <p className="mt-1 text-xs text-muted">Each hint lowers this attempt&apos;s score and brings the next review sooner.</p>
          )}
          <div className="mt-2 space-y-2">
            {problem.hints.slice(0, visibleHints).map((h, i) => (
              <div key={i} className="card p-3 text-sm">
                <div className="mb-1 text-xs font-medium text-muted">{HINT_NAMES[i]}</div>
                <Markdown text={i === 2 ? "```\n" + h + "\n```" : h} />
              </div>
            ))}
            {!finished && hintsUsed < 3 && stage === "solving" && (
              <button className="btn-secondary" onClick={() => setHintsUsed((h) => h + 1)}>
                Show {HINT_NAMES[hintsUsed].toLowerCase()}
              </button>
            )}
          </div>
        </div>

        {stage === "explaining" && (
          <ExplainPanel
            secondsLeft={explainLeft}
            hints={problem.hints}
            complexityChoices={props.complexityChoices}
            saving={saving}
            onSave={(c, cx) => save({ solved: c >= 2, gaveUp: false, confidence: c, complexity: cx, explained: true })}
            onCancel={() => setStage("solving")}
          />
        )}

        {stage === "checkin" && (
          <div className="card mt-6 border-good p-4">
            <h2 className="font-medium text-good">Accepted in {fmtTime(acceptedAfter ?? elapsed)}</h2>
            <p className="mt-3 text-sm font-medium">What&apos;s the time complexity of your solution?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {props.complexityChoices.map((c) => (
                <button key={c} className={complexity === c ? "btn-primary" : "btn-secondary"} onClick={() => setComplexity(c)}>
                  {c}
                </button>
              ))}
            </div>
            {mode === "mixed" && (
              <>
                <p className="mt-4 text-sm font-medium">Which pattern was it?</p>
                <select className="input mt-2" value={patternGuess} onChange={(e) => setPatternGuess(e.target.value)}>
                  <option value="">Pick one…</option>
                  {props.patternChoices.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <ConfidencePicker value={confidence} onChange={setConfidence} />
            {saveError && <p className="mt-2 text-sm text-bad">{saveError}</p>}
            <button
              className="btn-primary mt-4"
              disabled={!complexity || !confidence || saving || (mode === "mixed" && !patternGuess)}
              onClick={() => save({ solved: true, gaveUp: false, confidence, complexity })}
            >
              {saving ? "Saving…" : "Save and update my plan"}
            </button>
          </div>
        )}

        {stage === "done" && saved && (
          <ResultPanel
            saved={saved}
            gaveUp={gaveUp}
            complexity={complexity}
            optimal={problem.complexity}
            patternGuess={mode === "mixed" ? patternGuess : null}
            pattern={problem.pattern}
            patternName={props.patternName}
            nextHref={saved.next ? nextHref(saved.next) : null}
            diagnostic={!!props.diagnostic}
            source={problem.source}
          />
        )}
      </section>

      {/* Right: editor and results */}
      <section className="flex min-h-[70vh] flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
          <select
            className="input w-auto py-1"
            value={lang}
            onChange={(e) => {
              const l = e.target.value as Language;
              setLang(l);
              storageSet(`lang:${problem.slug}`, l);
            }}
            disabled={finished}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <span className="font-mono text-sm tabular-nums text-muted" title="Time on this problem">
            {fmtTime(elapsed)}
          </span>
          <div className="ml-auto flex gap-2">
            {!finished && stage !== "checkin" && (
              <button
                className="btn-ghost"
                disabled={!!running || saving}
                onClick={() => {
                  if (!confirm("Give up and see the approach? This counts as a miss.")) return;
                  setGaveUp(true);
                  save({ solved: false, gaveUp: true, confidence: null, complexity: null });
                }}
              >
                Give up
              </button>
            )}
            <button className="btn-secondary" disabled={!!running || finished || stage === "checkin"} onClick={() => execute("sample")}>
              {running === "run" ? "Running…" : "Run"}
            </button>
            <button className="btn-primary" disabled={!!running || finished || stage === "checkin"} onClick={() => execute("all")}>
              {running === "submit" ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
        <div className="min-h-[320px] flex-1">
          <Editor
            language={lang}
            value={code}
            onChange={(v) => setCode(v ?? "")}
            theme={dark ? "vs-dark" : "light"}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              tabSize: lang === "python" ? 4 : 2,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: finished,
            }}
          />
        </div>
        <ResultsPanel outcome={outcome} running={running} runner={runner} lang={lang} />
      </section>
    </div>
  );
}

function ConfidencePicker({ value, onChange }: { value: Confidence | null; onChange: (c: Confidence) => void }) {
  return (
    <>
      <p className="mt-4 text-sm font-medium">How did that feel?</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([1, 2, 3, 4] as Confidence[]).map((c) => (
          <button
            key={c}
            className={`rounded-md border p-2 text-left text-xs ${value === c ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2"}`}
            onClick={() => onChange(c)}
          >
            <div className="text-sm font-medium">{CONFIDENCE_LABELS[c].label}</div>
            <div className="text-muted">{CONFIDENCE_LABELS[c].help}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function ExplainPanel(props: {
  secondsLeft: number;
  hints: [string, string, string];
  complexityChoices: string[];
  saving: boolean;
  onSave: (c: Confidence, complexity: string | null) => void;
  onCancel: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [complexity, setComplexity] = useState<string | null>(null);
  return (
    <div className="card mt-6 border-good p-4">
      {!revealed ? (
        <>
          <h2 className="font-medium">Explain it out loud</h2>
          <p className="mt-1 text-sm text-muted">
            Say the approach, the data structures, the edge cases and the complexity, as you would to an interviewer.
          </p>
          <div className="my-3 font-mono text-3xl tabular-nums">{fmtTime(props.secondsLeft)}</div>
          <p className="text-sm font-medium">Time complexity?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {props.complexityChoices.map((c) => (
              <button key={c} className={complexity === c ? "btn-primary" : "btn-secondary"} onClick={() => setComplexity(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={() => setRevealed(true)}>
              Done, compare with the approach
            </button>
            <button className="btn-ghost" onClick={props.onCancel}>
              Code it instead
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="font-medium">The approach</h2>
          <Markdown text={props.hints[1]} className="mt-2 text-sm" />
          <Markdown text={"```\n" + props.hints[2] + "\n```"} className="text-sm" />
          <p className="mt-3 text-sm">Did your explanation match?</p>
          <ConfidencePicker value={confidence} onChange={setConfidence} />
          <button className="btn-primary mt-4" disabled={!confidence || props.saving} onClick={() => props.onSave(confidence!, complexity)}>
            {props.saving ? "Saving…" : "Save review"}
          </button>
        </>
      )}
    </div>
  );
}

function ResultPanel(props: {
  saved: { result: AttemptResult; next: PlanItem | null };
  gaveUp: boolean;
  complexity: string | null;
  optimal: { time: string; space: string };
  patternGuess: string | null;
  pattern: PatternId;
  patternName: string;
  nextHref: string | null;
  source?: { name: string; url: string };
  diagnostic?: boolean;
}) {
  const r = props.saved.result;
  const delta = Math.round(r.ratingAfter - r.ratingBefore);
  const nextReview = r.nextReview ? new Date(r.nextReview) : null;
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/·|\*/g, "").toLowerCase();
  return (
    <div className={`card mt-6 p-4 ${r.solved ? "border-good" : "border-warn"}`}>
      <h2 className="font-medium">{r.solved ? "Saved. Your plan has been updated." : "Logged as a miss. Your plan has been updated."}</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        <li>
          {props.patternName} rating: {Math.round(r.ratingBefore)} → <strong>{Math.round(r.ratingAfter)}</strong>{" "}
          <span className={delta >= 0 ? "text-good" : "text-bad"}>
            ({delta >= 0 ? "+" : ""}
            {delta})
          </span>
        </li>
        {r.solved && <li>Attempt score: {Math.round(r.score * 100)}%</li>}
        {r.fastTrack && <li className="text-good">Fast track: quick and clean, so you skip ahead and the next review is further out.</li>}
        {props.complexity && (
          <li>
            Complexity: you said {props.complexity}; optimal is {props.optimal.time} time, {props.optimal.space} space.{" "}
            {norm(props.complexity) === norm(props.optimal.time) ? "✓" : "Worth another look."}
          </li>
        )}
        {props.patternGuess && (
          <li>
            Pattern: {props.patternGuess === props.pattern ? `✓ ${props.patternName}` : `it was ${props.patternName}`}
          </li>
        )}
        {nextReview && <li>Next review: {nextReview.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</li>}
        {r.stuck && (
          <li className="text-warn">Two misses in a row in this pattern: the plan will give you an easier bridge problem next.</li>
        )}
      </ul>
      {props.source && (
        <p className="mt-3 text-xs text-muted">
          Modeled on{" "}
          <a className="underline" href={props.source.url} target="_blank" rel="noreferrer">
            {props.source.name}
          </a>
        </p>
      )}
      <div className="mt-4 flex gap-2">
        {props.diagnostic ? (
          <Link href="/diagnostic" className="btn-primary">
            Back to the diagnostic
          </Link>
        ) : props.nextHref ? (
          <Link href={props.nextHref} className="btn-primary">
            Next in today&apos;s plan
          </Link>
        ) : (
          <Link href="/today" className="btn-primary">
            Back to today
          </Link>
        )}
        <Link href="/today" className="btn-secondary">
          See the plan
        </Link>
      </div>
    </div>
  );
}
