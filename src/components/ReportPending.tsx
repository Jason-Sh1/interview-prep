"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** Shown until a report exists: asks the server to build it, then reloads the page. */
export function ReportPending({ id, message, generate }: { id: string; message: string; generate: (id: string) => Promise<void> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const run = useCallback(() => {
    setError(null);
    generate(id)
      .then(() => router.refresh())
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong"));
  }, [id, generate, router]);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);
  return (
    <div className="card mt-4 bg-surface-2 p-4 text-sm">
      {error ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-bad">Couldn&apos;t build the report: {error}</p>
          <button className="btn-secondary" onClick={run}>
            Try again
          </button>
        </div>
      ) : (
        <p className="animate-pulse">{message}</p>
      )}
    </div>
  );
}
