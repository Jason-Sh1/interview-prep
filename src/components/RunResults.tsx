"use client";
import { useState } from "react";
import type { RunOutcome } from "@/lib/runner/compare";
import type { Language } from "@/lib/runner/drivers";

export function ResultsPanel({
  outcome,
  running,
  runner,
  lang,
}: {
  outcome: RunOutcome | null;
  running: null | "run" | "submit";
  runner: "browser" | "judge0";
  lang: Language;
}) {
  // The selected test resets to the first failure whenever a new outcome arrives.
  const [selected, setSelected] = useState<{ outcome: RunOutcome | null; index: number }>({ outcome: null, index: 0 });
  const firstFail = outcome?.results.findIndex((r) => !r.passed) ?? -1;
  const open = selected.outcome === outcome ? selected.index : Math.max(0, firstFail);
  const setOpen = (index: number) => setSelected({ outcome, index });

  return (
    <div className="max-h-[40vh] min-h-40 overflow-y-auto border-t border-line bg-surface p-3 text-sm">
      {running && (
        <p className="text-muted">
          {running === "run" ? "Running sample tests" : "Running all tests"}
          {runner === "browser" && lang === "python" ? " (Python loads on the first run, which takes a few seconds)" : ""}…
        </p>
      )}
      {!running && !outcome && <p className="text-muted">Run checks the examples. Submit runs every test, including hidden edge cases.</p>}
      {!running && outcome && (
        <>
          <div className="flex items-center gap-3">
            <span
              className={`font-medium ${outcome.verdict === "accepted" ? "text-good" : outcome.verdict === "wrong_answer" ? "text-warn" : "text-bad"}`}
            >
              {VERDICT_LABEL[outcome.verdict]}
            </span>
            {outcome.total > 0 && (
              <span className="text-muted">
                {outcome.passed}/{outcome.total} tests passed
              </span>
            )}
          </div>
          {outcome.message && <pre className="mt-2 whitespace-pre-wrap rounded bg-surface-2 p-2 font-mono text-xs">{outcome.message}</pre>}
          {outcome.results.length > 0 && (
            <>
              <div className="mt-2 flex flex-wrap gap-1">
                {outcome.results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setOpen(i)}
                    className={`rounded px-2 py-0.5 text-xs ${r.passed ? "bg-good-soft text-good" : "bg-bad-soft text-bad"} ${open === i ? "ring-1 ring-current" : ""}`}
                  >
                    {r.sample ? `Example ${i + 1}` : r.label ? r.label : `Test ${i + 1}`}
                  </button>
                ))}
              </div>
              {outcome.results[open] && <TestDetail r={outcome.results[open]} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

export const VERDICT_LABEL: Record<RunOutcome["verdict"], string> = {
  accepted: "Accepted",
  wrong_answer: "Wrong answer",
  runtime_error: "Runtime error",
  time_limit: "Time limit exceeded",
  compile_error: "Compile error",
  internal_error: "Runner error",
};

function TestDetail({ r }: { r: RunOutcome["results"][number] }) {
  const row = (label: string, v: string) => (
    <div className="mt-1.5">
      <div className="text-xs text-muted">{label}</div>
      <pre className="whitespace-pre-wrap break-all rounded bg-surface-2 p-2 font-mono text-xs">{v}</pre>
    </div>
  );
  const clip = (s: string) => (s.length > 600 ? s.slice(0, 600) + " …" : s);
  return (
    <div className="mt-2">
      {row("Input", clip(r.input.map((v) => JSON.stringify(v)).join("\n")))}
      {r.error ? row("Error", r.error) : row("Your output", clip(JSON.stringify(r.actual ?? null)))}
      {row("Expected", clip(JSON.stringify(r.expected)))}
      {r.stdout && row("Printed", clip(r.stdout))}
    </div>
  );
}
