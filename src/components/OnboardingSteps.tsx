import { DIAGNOSTIC_MINUTES } from "@/lib/diagnostic/plan";

// Where a first-time user is in setting up: goals, then the diagnostic, then the plan.
const STEPS = [
  { label: "Your goals", detail: "2 minutes" },
  { label: "Diagnostic", detail: `about ${DIAGNOSTIC_MINUTES} minutes, skippable` },
  { label: "Your daily plan", detail: "start practicing" },
];

export function OnboardingSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-8 grid grid-cols-3 gap-2 text-xs" aria-label="Setup progress">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "next";
        return (
          <li
            key={s.label}
            aria-current={state === "current" ? "step" : undefined}
            className={`rounded-md border px-3 py-2 ${
              state === "current" ? "border-accent bg-accent-soft" : state === "done" ? "border-line text-muted" : "border-line text-muted"
            }`}
          >
            <div className={`font-medium ${state === "current" ? "text-accent" : ""}`}>
              {state === "done" ? "✓ " : `${n}. `}
              {s.label}
            </div>
            <div className="mt-0.5 text-muted">{s.detail}</div>
          </li>
        );
      })}
    </ol>
  );
}
