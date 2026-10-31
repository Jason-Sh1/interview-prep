"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserListener, BrowserSpeaker, speechRecognitionSupported } from "@/lib/interview/browser-voice";
import { fmtClock } from "@/lib/interview/timeline";
import type { Turn, TurnInput } from "@/lib/rounds/types";

interface Props {
  roundId: string;
  minutes: number;
  /** Milliseconds since Start when the page rendered, or null before Start. */
  elapsedAtRender: number | null;
  initialTranscript: Turn[];
  /** The artifact to send with each turn, so the interviewer sees the latest. */
  getArtifact: () => unknown;
  /** Ends the round (the parent saves the artifact and shows the report). */
  onEnd: () => Promise<void>;
  /** Shown before Start. */
  lobby: React.ReactNode;
  onStarted?: () => void;
  onTimeUp?: () => void;
}

interface Line {
  speaker: Turn["speaker"];
  text: string;
  pending?: boolean;
}

/** Prompts after this long without the candidate saying anything. */
const SILENCE_MS = 60_000;
const WRAP_MS = 3 * 60_000;

/**
 * The conversation half of a round: transcript, typed and spoken answers,
 * the interviewer's streamed (and spoken) replies, the clock, and End.
 */
export function ConversationPanel(props: Props) {
  const { roundId, minutes } = props;
  const [lines, setLines] = useState<Line[]>(() => props.initialTranscript.map((t) => ({ speaker: t.speaker, text: t.text })));
  const [started, setStarted] = useState(props.elapsedAtRender !== null);
  const [elapsed, setElapsed] = useState(props.elapsedAtRender ?? 0);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [bargeIn, setBargeIn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sttOk, setSttOk] = useState(false);

  const box = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const speaker = useRef<BrowserSpeaker | null>(null);
  const listener = useRef<BrowserListener | null>(null);
  const lastCandidateAt = useRef(Date.now());
  const lastNudgeAt = useRef(0);
  const voiceOnRef = useRef(voiceOn);
  const bargeInRef = useRef(bargeIn);
  const startAt = useRef<number | null>(props.elapsedAtRender !== null ? Date.now() - props.elapsedAtRender : null);
  const getArtifact = useRef(props.getArtifact);
  useEffect(() => {
    getArtifact.current = props.getArtifact;
    voiceOnRef.current = voiceOn;
    bargeInRef.current = bargeIn;
  });

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines, interim]);

  useEffect(() => {
    // Only known in the browser, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSttOk(speechRecognitionSupported());
    speaker.current = new BrowserSpeaker(setSpeaking);
    return () => {
      speaker.current?.cancel();
      listener.current?.stop();
      controller.current?.abort();
    };
  }, []);

  const remaining = minutes * 60_000 - elapsed;
  const timeUp = started && remaining <= 0;
  const onTimeUp = props.onTimeUp;
  useEffect(() => {
    if (timeUp) {
      listener.current?.stop();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setListening(false);
      onTimeUp?.();
    }
  }, [timeUp, onTimeUp]);

  const turn = useCallback(
    async (input: TurnInput) => {
      controller.current?.abort();
      speaker.current?.cancel();
      const ac = new AbortController();
      controller.current = ac;
      if (input.kind === "say") {
        lastCandidateAt.current = Date.now();
        setLines((l) => [...l, { speaker: "candidate", text: input.text }]);
      }
      setBusy(true);
      setNotice(null);
      try {
        const res = await fetch(`/api/rounds/${roundId}/turn`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input, artifact: getArtifact.current() }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "The interviewer couldn't answer.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          if (!text) setLines((l) => [...l, { speaker: "interviewer", text: "", pending: true }]);
          text += chunk;
          if (voiceOnRef.current) speaker.current?.push(chunk);
          setLines((l) => [...l.slice(0, -1), { speaker: "interviewer", text, pending: true }]);
        }
        if (voiceOnRef.current) speaker.current?.end();
        if (text) setLines((l) => [...l.slice(0, -1), { speaker: "interviewer", text }]);
      } catch (e) {
        if (ac.signal.aborted) return;
        setNotice(e instanceof Error ? e.message : "The interviewer couldn't answer.");
      } finally {
        if (controller.current === ac) setBusy(false);
      }
    },
    [roundId],
  );

  // The clock, plus the wrap-up prompt and silence nudges.
  useEffect(() => {
    if (!started) return;
    const wrapKey = `round-wrap:${roundId}`;
    const id = setInterval(() => {
      if (startAt.current === null) return;
      const now = Date.now();
      const el = now - startAt.current;
      setElapsed(el);
      const left = minutes * 60_000 - el;
      if (left <= 0) return;
      let wrapped = false;
      try {
        wrapped = sessionStorage.getItem(wrapKey) === "1";
      } catch {
        /* storage unavailable */
      }
      if (left <= WRAP_MS && !wrapped) {
        try {
          sessionStorage.setItem(wrapKey, "1");
        } catch {
          /* storage unavailable */
        }
        void turn({ kind: "wrap" });
        return;
      }
      const quiet = now - Math.max(lastCandidateAt.current, lastNudgeAt.current);
      if (quiet > SILENCE_MS && !speaker.current?.speaking && !controller.current?.signal.aborted && document.visibilityState === "visible") {
        lastNudgeAt.current = now;
        void turn({ kind: "silence" });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [started, minutes, roundId, turn]);

  async function start() {
    startAt.current = Date.now();
    lastCandidateAt.current = Date.now();
    setStarted(true);
    props.onStarted?.();
    await turn({ kind: "start" });
  }

  function send() {
    const text = draft.trim();
    if (!text || timeUp) return;
    setDraft("");
    void turn({ kind: "say", text, source: "typed" });
  }

  function toggleMic() {
    if (listening) {
      listener.current?.stop();
      listener.current = null;
      setListening(false);
      setInterim("");
      return;
    }
    const l = new BrowserListener(
      {
        onInterim: (t) => {
          setInterim(t);
          if (t && speaker.current?.speaking && bargeInRef.current && t.split(/\s+/).length >= 3) {
            speaker.current.cancel();
            controller.current?.abort();
          }
          if (t) lastCandidateAt.current = Date.now();
        },
        onFinal: (t) => {
          setInterim("");
          // Without barge-in, ignore what the mic hears while the interviewer talks (its own voice).
          if (speaker.current?.speaking && !bargeInRef.current) return;
          void turn({ kind: "say", text: t, source: "voice" });
        },
        onError: (m) => {
          setNotice(m);
          setListening(false);
        },
      },
      () => Date.now(),
    );
    listener.current = l;
    l.start();
    setListening(true);
  }

  async function end() {
    if (ending) return;
    if (!timeUp && started && !confirm("End the round now and get your report?")) return;
    setEnding(true);
    controller.current?.abort();
    speaker.current?.cancel();
    listener.current?.stop();
    try {
      await props.onEnd();
    } catch {
      setNotice("Couldn't end the round. Try again.");
      setEnding(false);
    }
  }

  if (!started) {
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        {props.lobby}
        <button className="btn-primary self-start" onClick={start}>
          Start the round
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 text-sm">
        <span className={`font-mono tabular-nums ${remaining < WRAP_MS ? "text-bad" : ""}`} aria-label="Time left">
          {fmtClock(Math.max(0, remaining))}
        </span>
        {speaking && <span className="text-xs text-accent">Interviewer speaking…</span>}
        {busy && !speaking && <span className="animate-pulse text-xs text-muted">…</span>}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted">
            <input
              type="checkbox"
              checked={voiceOn}
              onChange={(e) => {
                setVoiceOn(e.target.checked);
                if (!e.target.checked) speaker.current?.cancel();
              }}
            />
            Voice
          </label>
          <label className="flex items-center gap-1 text-xs text-muted" title="Use headphones: lets you interrupt the interviewer by talking">
            <input type="checkbox" checked={bargeIn} onChange={(e) => setBargeIn(e.target.checked)} /> Talk over
          </label>
          <button className="btn-secondary" onClick={end} disabled={ending}>
            {ending ? "Ending…" : "End"}
          </button>
        </div>
      </div>

      <div ref={box} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} className={l.speaker === "candidate" ? "ml-8 rounded-lg bg-accent-soft p-2" : "mr-8 rounded-lg bg-surface-2 p-2"}>
            <div className="text-xs text-muted">{l.speaker === "candidate" ? "You" : "Interviewer"}</div>
            <p className={`whitespace-pre-wrap ${l.pending ? "opacity-80" : ""}`}>{l.text}</p>
          </div>
        ))}
        {interim && <div className="ml-8 rounded-lg border border-dashed border-line p-2 italic text-muted">{interim}</div>}
      </div>

      {notice && <div className="border-t border-line bg-warn-soft px-4 py-2 text-xs text-warn">{notice}</div>}
      {timeUp ? (
        <div className="border-t border-line p-4 text-sm">
          Time&apos;s up.{" "}
          <button className="btn-primary ml-2" onClick={end} disabled={ending}>
            {ending ? "Ending…" : "End and get your report"}
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2 border-t border-line p-3">
          {sttOk && (
            <button className={listening ? "btn-primary" : "btn-secondary"} onClick={toggleMic} aria-pressed={listening} title="Talk instead of typing">
              {listening ? "Mic on" : "Mic"}
            </button>
          )}
          <textarea
            className="input min-h-10 flex-1 resize-none"
            rows={2}
            placeholder={listening ? "Listening… or type here" : "Type your answer (Enter to send, Shift+Enter for a new line)"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="btn-primary" onClick={send} disabled={!draft.trim()}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}
