import { Tag } from "@/components/badges";
import type { DesignArtifact } from "@/lib/design/scene";
import { DESIGN_TOPIC_BY_ID } from "@/lib/design/topics";
import { FinalBoard } from "./FinalBoard";

interface Extra {
  components?: { name: string; core: boolean; status: "board" | "spoken" | "missing"; probe: string }[];
  dives?: { id: string; title: string; coverage: number; strong: string }[];
}

const STATUS = {
  board: { label: "On the board", tone: "good" },
  spoken: { label: "Only said", tone: "warn" },
  missing: { label: "Missing", tone: "bad" },
} as const;

/** The design part of the report: the final board, components, and what a strong answer covers. */
export function DesignReportSection({ topicId, artifact, extra }: { topicId: string; artifact: DesignArtifact; extra?: Record<string, unknown> }) {
  const topic = DESIGN_TOPIC_BY_ID.get(topicId)!;
  const x = (extra ?? {}) as Extra;
  return (
    <>
      <h2 className="mt-8 text-lg font-semibold">Your whiteboard</h2>
      <FinalBoard elements={artifact.elements} />
      {artifact.notes.trim() && <pre className="card mt-2 whitespace-pre-wrap p-3 font-mono text-xs">{artifact.notes}</pre>}

      {x.components && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Components</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {x.components.map((c) => (
              <li key={c.name} className="card p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.core && <Tag>Core</Tag>}
                  <Tag tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Tag>
                </div>
                {c.status === "missing" && <p className="mt-1 text-muted">{c.probe}</p>}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-8 text-lg font-semibold">What a strong answer covers</h2>
      <div className="card mt-2 space-y-3 p-4 text-sm">
        <div>
          <div className="font-medium">Requirements</div>
          <p className="text-muted">
            In scope: {topic.functional.join("; ")}. Non-functional: {topic.nonFunctional.join("; ")}.
          </p>
        </div>
        <div>
          <div className="font-medium">Estimates</div>
          <ul className="list-disc pl-5 text-muted">
            {topic.estimates.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-medium">Deep dives</div>
          <ul className="mt-1 space-y-2">
            {topic.deepDives.map((d) => {
              const cov = x.dives?.find((y) => y.id === d.id)?.coverage;
              return (
                <li key={d.id}>
                  <span className="font-medium">{d.title}</span>
                  {cov !== undefined && <span className="text-muted"> · you covered {Math.round(cov * 100)}% of the key points</span>}
                  <p className="text-muted">{d.strong}</p>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <div className="font-medium">Trade-offs worth discussing</div>
          <p className="text-muted">{topic.tradeoffs.join(" · ")}</p>
        </div>
      </div>
    </>
  );
}
