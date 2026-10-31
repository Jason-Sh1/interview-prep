"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { finishRoundAction } from "@/app/rounds/actions";
import { Tag } from "@/components/badges";
import { ConversationPanel } from "@/components/rounds/ConversationPanel";
import type { BehavioralArtifact } from "@/lib/behavioral/artifact";
import { competencyLabel } from "@/lib/behavioral/competencies";
import type { Turn } from "@/lib/rounds/types";

interface Props {
  roundId: string;
  title: string;
  companyName: string | null;
  minutes: number;
  elapsedAtRender: number | null;
  initialTranscript: Turn[];
  initialArtifact: BehavioralArtifact;
  questions: { id: string; text: string; competencies: string[] }[];
}

export function BehavioralRoom(props: Props) {
  const { roundId } = props;
  const router = useRouter();
  const [notes, setNotes] = useState(props.initialArtifact.notes);
  const [frozen, setFrozen] = useState(false);
  const artifact = useRef<BehavioralArtifact>(props.initialArtifact);
  const stories = props.initialArtifact.stories;

  return (
    <div className="grid flex-1 grid-cols-1 lg:h-[calc(100vh-3.5rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="flex flex-col gap-4 overflow-y-auto border-line p-4 text-sm lg:border-r">
        <div>
          <div className="font-medium">{props.title}</div>
          <p className="text-xs text-muted">
            {props.questions.length} questions{props.companyName ? ` · ${props.companyName} style` : ""} · {props.minutes} minutes
          </p>
        </div>

        <div>
          <div className="font-medium">Your stories</div>
          {stories.length ? (
            <ul className="mt-1 space-y-1">
              {stories.map((s) => (
                <li key={s.id}>
                  <details>
                    <summary className="cursor-pointer">
                      {s.title}
                      {s.competencies.length > 0 && <span className="text-xs text-muted"> · {s.competencies.map(competencyLabel).join(", ")}</span>}
                    </summary>
                    <p className="mt-1 pl-4 text-xs text-muted">{s.summary || "No details yet."}</p>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted">Your story bank is empty, so answer from memory. Build it before the next round.</p>
          )}
        </div>

        <details>
          <summary className="cursor-pointer font-medium">Question set (peek if you want to)</summary>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {props.questions.map((q) => (
              <li key={q.id}>
                {q.text}{" "}
                {q.competencies.map((c) => (
                  <Tag key={c}>{competencyLabel(c)}</Tag>
                ))}
              </li>
            ))}
          </ol>
        </details>

        <div className="flex flex-1 flex-col">
          <label className="label" htmlFor="behavioral-notes">
            Notes (the interviewer sees these too)
          </label>
          <textarea
            id="behavioral-notes"
            className="input min-h-24 flex-1 text-xs"
            value={notes}
            readOnly={frozen}
            placeholder="Jot down which story you'll use, key numbers…"
            onChange={(e) => {
              setNotes(e.target.value);
              artifact.current = { ...artifact.current, notes: e.target.value };
            }}
          />
        </div>
      </section>
      <section className="flex min-h-[70vh] flex-col lg:min-h-0">
        <ConversationPanel
          roundId={roundId}
          minutes={props.minutes}
          elapsedAtRender={props.elapsedAtRender}
          initialTranscript={props.initialTranscript}
          getArtifact={() => artifact.current}
          onTimeUp={() => setFrozen(true)}
          onEnd={async () => {
            await finishRoundAction(roundId, artifact.current);
            router.refresh();
          }}
          lobby={
            <div className="space-y-2 text-sm">
              <h2 className="text-lg font-semibold">Ready when you are</h2>
              <p>
                The clock ({props.minutes} minutes) starts when you press Start. The interviewer asks {props.questions.length} questions and follows up on
                each answer.
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-muted">
                <li>Answer in STAR order: a sentence or two of situation and task, then what you did, then the result with a number.</li>
                <li>Say &quot;I&quot; for your own actions, and end with what you learned.</li>
                <li>Aim for about two minutes per answer. Use the Mic button to talk, or type.</li>
              </ul>
            </div>
          }
        />
      </section>
    </div>
  );
}
