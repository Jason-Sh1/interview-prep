import Link from "next/link";
import { Tag } from "@/components/badges";
import { HIRE_LABELS } from "@/lib/feedback/analyze";
import type { Round } from "@/lib/rounds";
import { ROUND_INFO } from "@/lib/rounds/types";

/** The list of a kind's past rounds, newest first. */
export function PastRounds({ rounds, titleOf }: { rounds: Round[]; titleOf: (r: Round) => string }) {
  if (!rounds.length) return null;
  return (
    <>
      <h2 className="mt-12 text-lg font-semibold">Past rounds</h2>
      <ul className="mt-3 space-y-2">
        {rounds.map((r) => (
          <li key={r.id}>
            <Link href={`${ROUND_INFO[r.kind].path}/${r.id}`} className="card flex flex-wrap items-center gap-2 p-3 text-sm hover:border-accent">
              <span className="font-medium">{titleOf(r)}</span>
              {!r.endedAt && <Tag tone="warn">{r.startedAt ? "Not finished" : "Not started"}</Tag>}
              {r.report && (
                <>
                  <Tag>{HIRE_LABELS[r.report.hire.signal]}</Tag>
                  <span className="text-muted">{r.report.overall.toFixed(1)} / 4</span>
                </>
              )}
              <span className="ml-auto text-muted" suppressHydrationWarning>
                {r.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
