"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { finishRoundAction } from "@/app/rounds/actions";
import { useDarkMode } from "@/components/CodeEditor";
import { ConversationPanel } from "@/components/rounds/ConversationPanel";
import type { DesignArtifact, SceneElement } from "@/lib/design/scene";
import type { Turn } from "@/lib/rounds/types";

const Whiteboard = dynamic(() => import("@/components/rounds/Whiteboard"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading whiteboard…</div>,
});

interface Props {
  roundId: string;
  title: string;
  prompt: string;
  minutes: number;
  elapsedAtRender: number | null;
  initialTranscript: Turn[];
  initialArtifact: DesignArtifact;
}

const SAVE_DEBOUNCE_MS = 5_000;

export function DesignRoom(props: Props) {
  const { roundId } = props;
  const router = useRouter();
  const dark = useDarkMode();
  const [notes, setNotes] = useState(props.initialArtifact.notes);
  const [started, setStarted] = useState(props.elapsedAtRender !== null);
  const [frozen, setFrozen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const artifact = useRef<DesignArtifact>(props.initialArtifact);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    fetch(`/api/rounds/${roundId}/artifact`, { method: "POST", body: JSON.stringify(artifact.current), keepalive: true })
      .then(async (res) =>
        setSaveError(res.ok ? null : (((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't save the whiteboard.")),
      )
      .catch(() => setSaveError("Couldn't save the whiteboard; check your connection."));
  }, [roundId]);

  const changed = useCallback(() => {
    if (!started || frozen) return;
    dirty.current = true;
    if (!timer.current) timer.current = setTimeout(save, SAVE_DEBOUNCE_MS);
  }, [save, started, frozen]);

  useEffect(() => {
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [save]);

  const onTimeUp = useCallback(() => {
    save();
    setFrozen(true);
  }, [save]);

  return (
    <div className="grid flex-1 grid-cols-1 lg:h-[calc(100vh-3.5rem)] lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <section className="flex min-h-[75vh] flex-col border-line lg:min-h-0 lg:border-r">
        <div className="border-b border-line px-4 py-2">
          <div className="font-medium">{props.title}</div>
          <p className="text-xs text-muted">{props.prompt}</p>
        </div>
        <div className="relative min-h-[50vh] flex-1">
          <Whiteboard
            initialElements={props.initialArtifact.elements}
            dark={dark}
            readOnly={frozen}
            onChange={(elements: SceneElement[]) => {
              artifact.current = { ...artifact.current, elements };
              changed();
            }}
          />
        </div>
        <div className="border-t border-line p-2">
          <label className="label" htmlFor="design-notes">
            Notes (requirements, estimates, API): the interviewer sees these too
          </label>
          <textarea
            id="design-notes"
            className="input h-24 font-mono text-xs"
            value={notes}
            readOnly={frozen}
            onChange={(e) => {
              setNotes(e.target.value);
              artifact.current = { ...artifact.current, notes: e.target.value };
              changed();
            }}
          />
          {saveError && <p className="mt-1 text-xs text-bad">{saveError}</p>}
        </div>
      </section>
      <section className="flex min-h-[60vh] flex-col lg:min-h-0">
        <ConversationPanel
          roundId={roundId}
          minutes={props.minutes}
          elapsedAtRender={props.elapsedAtRender}
          initialTranscript={props.initialTranscript}
          getArtifact={() => artifact.current}
          onStarted={() => setStarted(true)}
          onTimeUp={onTimeUp}
          onEnd={async () => {
            if (timer.current) clearTimeout(timer.current);
            await finishRoundAction(roundId, artifact.current);
            router.refresh();
          }}
          lobby={
            <div className="space-y-2 text-sm">
              <h2 className="text-lg font-semibold">Ready when you are</h2>
              <p>
                The clock ({props.minutes} minutes) starts when you press Start. The interviewer opens with the prompt; ask clarifying questions, then
                design on the whiteboard while you talk.
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-muted">
                <li>Use the Mic button to talk, or type. Headphones stop the interviewer hearing itself.</li>
                <li>Label your boxes (double-click a shape to type in it) and connect them with arrows: the interviewer reads labels and arrows.</li>
                <li>A rough plan: requirements, estimates, API and data model, high-level design, deep dives, scale and failure, summary.</li>
              </ul>
            </div>
          }
        />
      </section>
    </div>
  );
}
