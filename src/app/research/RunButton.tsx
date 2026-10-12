"use client";
import { useState, useTransition } from "react";
import { startResearchAction } from "./actions";

export function RunButton({ disabled, label }: { disabled: boolean; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="text-right">
      <button
        className="btn-primary"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const r = await startResearchAction();
            setError(r.error ?? null);
          })
        }
      >
        {pending ? "Starting…" : label}
      </button>
      {error && <p className="mt-1 text-sm text-bad">{error}</p>}
    </div>
  );
}
