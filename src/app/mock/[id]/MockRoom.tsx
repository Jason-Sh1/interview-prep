"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DifficultyBadge, Tag } from "@/components/badges";
import { Editor, useDarkMode } from "@/components/CodeEditor";
import { Markdown } from "@/components/Markdown";
import { ResultsPanel } from "@/components/RunResults";
import { BrowserListener, BrowserSpeaker, speechRecognitionSupported } from "@/lib/interview/browser-voice";
import type { LiveKitVoice } from "@/lib/interview/livekit-voice";
import { Recorder } from "@/lib/interview/recorder";
import { fmtClock, type Line } from "@/lib/interview/timeline";
import type { InterviewerKind, MockConfig, Speaker, TurnKind, VoiceMode } from "@/lib/interview/types";
import type { PublicProblem } from "@/lib/problems/public";
import type { TestCase } from "@/lib/problems/types";
import { preloadPython, runInBrowser } from "@/lib/runner/browser";
import type { RunOutcome } from "@/lib/runner/compare";
import { LANGUAGES, type Language } from "@/lib/runner/drivers";
import { endMockAction } from "../actions";

interface Props {
  sessionId: string;
  problem: PublicProblem;
  patternName: string;
  companyName: string | null;
  samples: TestCase[];
  allTests: TestCase[] | null;
  runner: "browser" | "judge0";
  starters: Record<Language, string>;
  initialLanguage: Language;
  initialCode: string | null;
  initialLines: Line[];
  config: MockConfig;
  voice: VoiceMode;
  interviewer: InterviewerKind;
  /** Session clock (ms) when the page rendered on the server. */
  elapsedAtRender: number;
  /** Session clock (ms) when Start was first pressed; null if it hasn't been yet. */
  startT: number | null;
}

interface ShownLine {
  id: string;
  speaker: Speaker;
  text: string;
}

type IvState = "idle" | "connecting" | "listening" | "thinking" | "speaking";

const SILENCE_MS = 40_000;
const SILENCE_GAP_MS = 60_000;
const WRAP_MS = 2 * 60_000;

export function MockRoom(props: Props) {
  const { sessionId, problem, samples, runner, config } = props;
  const router = useRouter();
  const dark = useDarkMode();
  const totalMs = config.minutes * 60_000;

  // Session clock: milliseconds since the session started, aligned to the server's.
  const clockStart = useRef(0);
  const now = useCallback(() => Date.now() - clockStart.current, []);

  const [started, setStarted] = useState(false);
  // The countdown runs from the first Start press, not from when the session was set up.
  const [startT, setStartT] = useState<number | null>(props.startT);
  const startTRef = useRef(props.startT);
  const [elapsed, setElapsed] = useState(props.elapsedAtRender);
  const [lines, setLines] = useState<ShownLine[]>(() =>
    props.initialLines.map((l, i) => ({ id: `init-${i}`, speaker: l.speaker, text: l.text })),
  );
  const [interim, setInterim] = useState("");
  const [ivState, setIvState] = useState<IvState>("idle");
  const [micOn, setMicOn] = useState(true);
  const [bargeIn, setBargeIn] = useState(false);
  const [typed, setTyped] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const [lang, setLang] = useState<Language>(props.initialLanguage);
  const [codeByLang] = useState<Record<Language, string>>(() => ({
    ...props.starters,
    ...(props.initialCode !== null ? { [props.initialLanguage]: props.initialCode } : {}),
  }));
  const codeRef = useRef<Record<Language, string>>({ ...codeByLang });
  const langRef = useRef(lang);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [running, setRunning] = useState<null | "run" | "submit">(null);

  const recorder = useRef<Recorder | null>(null);
  const listener = useRef<BrowserListener | null>(null);
  const speaker = useRef<BrowserSpeaker | null>(null);
  const lk = useRef<LiveKitVoice | null>(null);
  const turnAbort = useRef<AbortController | null>(null);
  const speaking = useRef(false);
  const speakingEndedAt = useRef(0);
  const bargeInRef = useRef(bargeIn);
  const lastCandidateAt = useRef(0);
  const lastInterviewerAt = useRef(0);
  const lastSilenceTurnAt = useRef(-Infinity);
  // Already inside the last two minutes when the page loads (a reload): the wrap-up was given before.
  const wrapSent = useRef(props.startT !== null && totalMs - (props.elapsedAtRender - props.startT) <= WRAP_MS);
  const lineSeq = useRef(0);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bargeInRef.current = bargeIn;
  }, [bargeIn]);

  useEffect(() => {
    clockStart.current = Date.now() - props.elapsedAtRender;
    lastCandidateAt.current = lastInterviewerAt.current = props.elapsedAtRender;
    const rec = new Recorder(sessionId, () => Date.now() - clockStart.current);
    recorder.current = rec;
    rec.start();
    const onHide = () => rec.beacon();
    window.addEventListener("pagehide", onHide);
    const tick = setInterval(() => setElapsed(Date.now() - clockStart.current), 1000);
    return () => {
      clearInterval(tick);
      window.removeEventListener("pagehide", onHide);
      rec.stop();
      void rec.flush();
    };
  }, [sessionId, props.elapsedAtRender]);

  useEffect(() => {
    if (lang === "python" && runner === "browser") preloadPython();
  }, [lang, runner]);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: "nearest" });
  }, [lines, interim]);

  const upsertLine = useCallback((line: ShownLine) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.id === line.id);
      if (i < 0) return [...ls, line];
      const copy = ls.slice();
      copy[i] = line;
      return copy;
    });
  }, []);
  const removeLine = useCallback((id: string) => setLines((ls) => ls.filter((l) => l.id !== id)), []);

  // ---------------------------------------------------------------------------
  // Browser voice: the app runs each turn and speaks the streamed reply.

  const browserTurn = useCallback(
    async (kind: TurnKind, text?: string, startT?: number, source: "browser-stt" | "typed" = "browser-stt") => {
      turnAbort.current?.abort();
      speaker.current?.cancel();
      const ac = new AbortController();
      turnAbort.current = ac;
      if (kind === "utterance" && text) {
        upsertLine({ id: `c-${++lineSeq.current}`, speaker: "candidate", text });
        lastCandidateAt.current = now();
      }
      // Make sure the interviewer sees the latest code.
      const code = codeRef.current[langRef.current];
      recorder.current?.snapshotIfDirty(code, langRef.current);
      await recorder.current?.flush();
      if (ac.signal.aborted) return;
      setIvState("thinking");
      const id = `i-${++lineSeq.current}`;
      let reply = "";
      try {
        const res = await fetch(`/api/mock/${sessionId}/turn`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, text, startT, source }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          reply += value;
          upsertLine({ id, speaker: "interviewer", text: reply });
          speaker.current?.push(value);
        }
        speaker.current?.end();
        if (!reply.trim()) removeLine(id);
        else lastInterviewerAt.current = now();
        if (!speaking.current) setIvState("listening");
      } catch (e) {
        if (ac.signal.aborted) return;
        setNotice(`The interviewer couldn't respond: ${e instanceof Error ? e.message : String(e)}`);
        setIvState("listening");
      }
    },
    [sessionId, now, upsertLine, removeLine],
  );

  const startBrowserVoice = useCallback(() => {
    speaker.current = new BrowserSpeaker((on) => {
      speaking.current = on;
      if (on) setIvState("speaking");
      else {
        speakingEndedAt.current = now();
        setIvState((s) => (s === "speaking" ? "listening" : s));
      }
    });
    listener.current = new BrowserListener(
      {
        onInterim(text) {
          if (speaking.current) {
            if (!bargeInRef.current) {
              listener.current?.discard();
              return;
            }
            if (text.split(/\s+/).length >= 2) {
              // The candidate talked over the interviewer: stop talking and listen.
              turnAbort.current?.abort();
              speaker.current?.cancel();
              recorder.current?.push({ type: "marker", t: now(), payload: { what: "barge-in" } });
            }
          }
          setInterim(text);
        },
        onFinal(text, startedAt) {
          setInterim("");
          // Ignore anything that started while the interviewer was talking (its own voice), unless barge-in is on.
          if (!bargeInRef.current && (speaking.current || startedAt < speakingEndedAt.current + 300)) return;
          void browserTurn("utterance", text, Math.max(0, Math.round(startedAt)));
        },
        onError: (m) => setNotice(m),
      },
      now,
    );
    if (micOn) listener.current.start();
    if (!speechRecognitionSupported()) setNotice("Speech recognition isn't available in this browser, so type your answers below. Chrome or Edge support talking.");
  }, [browserTurn, micOn, now]);

  // ---------------------------------------------------------------------------
  // LiveKit voice: the agent worker runs the turns; the page shows the transcript.

  const startLiveKit = useCallback(async () => {
    const { LiveKitVoice } = await import("@/lib/interview/livekit-voice");
    const v = new LiveKitVoice(sessionId, {
      onLine: ({ id, speaker: who, text, final }) => {
        if (who === "candidate" && !final) {
          setInterim(text);
          return;
        }
        if (who === "candidate") {
          setInterim("");
          lastCandidateAt.current = now();
        } else lastInterviewerAt.current = now();
        upsertLine({ id: `lk-${id}`, speaker: who, text });
      },
      onAgentState: (s) => setIvState(s === "listening" || s === "thinking" || s === "speaking" || s === "connecting" ? s : "idle"),
      onError: (m) => setNotice(m),
    });
    lk.current = v;
    try {
      await v.connect();
    } catch (e) {
      setNotice(`Couldn't connect to the voice room: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [sessionId, now, upsertLine]);

  const eventTurn = useCallback(
    (kind: "run" | "silence" | "wrap") => {
      if (props.voice === "livekit") void lk.current?.nudge(kind);
      else void browserTurn(kind);
    },
    [props.voice, browserTurn],
  );

  async function start() {
    setStarted(true);
    if (startTRef.current === null) {
      startTRef.current = now();
      setStartT(startTRef.current);
    }
    recorder.current?.push({ type: "marker", t: now(), payload: { what: "start", detail: props.voice } });
    recorder.current?.snapshot(codeRef.current[lang], lang);
    // The agent's first turn reads the clock from the stored start marker, so store it first.
    if (props.voice === "livekit") {
      await recorder.current?.flush();
      await startLiveKit();
    }
    else {
      startBrowserVoice();
      if (props.initialLines.length === 0) void browserTurn("start");
      else setIvState("listening");
    }
  }

  // Silence detection and the wrap-up warning.
  useEffect(() => {
    if (!started || ending) return;
    const t = setInterval(() => {
      const n = now();
      if (!wrapSent.current && totalMs - (n - (startTRef.current ?? n)) <= WRAP_MS) {
        wrapSent.current = true;
        eventTurn("wrap");
        return;
      }
      const busy = speaking.current || ivState === "thinking" || ivState === "speaking" || interim !== "";
      const quiet = n - Math.max(lastCandidateAt.current, lastInterviewerAt.current);
      if (!busy && quiet > SILENCE_MS && n - lastSilenceTurnAt.current > SILENCE_GAP_MS) {
        lastSilenceTurnAt.current = n;
        eventTurn("silence");
      }
    }, 3000);
    return () => clearInterval(t);
  }, [started, ending, now, totalMs, eventTurn, ivState, interim]);

  // Stop voice when leaving the page.
  useEffect(
    () => () => {
      turnAbort.current?.abort();
      listener.current?.stop();
      speaker.current?.cancel();
      void lk.current?.disconnect();
    },
    [],
  );

  function toggleMic() {
    const on = !micOn;
    setMicOn(on);
    if (props.voice === "livekit") void lk.current?.setMicrophone(on);
    else if (on) listener.current?.start();
    else listener.current?.stop();
  }

  function sendTyped() {
    const text = typed.trim();
    if (!text) return;
    setTyped("");
    if (props.voice === "livekit") {
      upsertLine({ id: `typed-${++lineSeq.current}`, speaker: "candidate", text });
      void lk.current?.sendText(text);
    } else void browserTurn("utterance", text, undefined, "typed");
  }

  // ---------------------------------------------------------------------------
  // Editor and test runs

  const execute = async (scope: "sample" | "all") => {
    const code = codeRef.current[lang];
    setRunning(scope === "sample" ? "run" : "submit");
    recorder.current?.snapshot(code, lang);
    let res: RunOutcome;
    try {
      if (runner === "judge0") {
        const r = await fetch("/api/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug: problem.slug, language: lang, code, scope }),
        });
        res = r.ok
          ? await r.json()
          : { verdict: "internal_error", results: [], passed: 0, total: 0, message: (await r.json()).error, runner: "judge0" };
      } else {
        res = await runInBrowser(problem.signature, lang, code, scope === "sample" ? samples : props.allTests!);
      }
    } catch (e) {
      res = { verdict: "internal_error", results: [], passed: 0, total: 0, message: String(e), runner };
    }
    setOutcome(res);
    setRunning(null);
    recorder.current?.push({
      type: "run",
      t: now(),
      payload: {
        scope,
        verdict: res.verdict,
        passed: res.passed,
        total: res.total,
        failingLabels: [...new Set(res.results.filter((r) => !r.passed).map((r) => r.label ?? (r.sample ? "example" : "hidden test")))].slice(0, 50),
        ...(res.message ? { message: res.message.slice(0, 2000) } : {}),
      },
    });
    if (started) eventTurn("run");
    else void recorder.current?.flush();
  };

  async function end() {
    if (!confirm("End the interview? Your timeline and transcript are saved for review.")) return;
    setEnding(true);
    turnAbort.current?.abort();
    listener.current?.stop();
    speaker.current?.cancel();
    await lk.current?.disconnect();
    const code = codeRef.current[lang];
    recorder.current?.snapshot(code, lang);
    await recorder.current?.flush();
    try {
      await endMockAction(sessionId, code);
      router.refresh();
    } catch (e) {
      setNotice(`Couldn't end the interview: ${e instanceof Error ? e.message : String(e)}`);
      setEnding(false);
    }
  }

  const remaining = totalMs - (startT === null ? 0 : Math.max(0, elapsed - startT));
  const STATE_LABEL: Record<IvState, string> = {
    idle: "Not started",
    connecting: "Connecting…",
    listening: micOn ? "Listening" : "Mic off",
    thinking: "Thinking…",
    speaking: "Speaking",
  };

  return (
    <div className="grid flex-1 grid-cols-1 lg:h-[calc(100vh-3.5rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="flex min-h-0 flex-col border-line lg:border-r">
        {/* Interviewer panel */}
        <div className="border-b border-line p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                ivState === "speaking" ? "animate-pulse bg-accent" : ivState === "thinking" ? "animate-pulse bg-warn" : started ? "bg-good" : "bg-surface-2"
              }`}
            />
            <div>
              <div className="text-sm font-medium">Interviewer{props.companyName ? ` · ${props.companyName} style` : ""}</div>
              <div className="text-xs text-muted">
                {STATE_LABEL[ivState]} · {props.interviewer === "claude" ? "Claude" : "scripted"} · {props.voice === "livekit" ? "LiveKit voice" : "browser voice"}
              </div>
            </div>
            <span
              className={`ml-auto font-mono text-lg tabular-nums ${remaining <= WRAP_MS ? "text-bad" : ""}`}
              title={`${config.minutes}-minute interview`}
            >
              {fmtClock(remaining)}
            </span>
          </div>

          {!started ? (
            <div className="mt-4">
              <p className="text-sm text-muted">
                {props.voice === "browser"
                  ? "Your browser will ask to use the microphone. Headphones help, so the interviewer doesn't hear itself."
                  : "You'll join a voice room with the interviewer. Your browser will ask to use the microphone."}
              </p>
              <button className="btn-primary mt-3" onClick={start}>
                {props.initialLines.length ? "Resume the interview" : "Start the interview"}
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className={micOn ? "btn-secondary" : "btn-primary"} onClick={toggleMic} disabled={ending}>
                {micOn ? "Mute mic" : "Unmute mic"}
              </button>
              {props.voice === "browser" && (
                <label className="flex items-center gap-1.5 text-xs text-muted" title="Lets you interrupt by talking. Needs headphones, or the interviewer interrupts itself.">
                  <input type="checkbox" checked={bargeIn} onChange={(e) => setBargeIn(e.target.checked)} />
                  Talk over the interviewer (headphones)
                </label>
              )}
              <button className="btn-ghost ml-auto" onClick={end} disabled={ending}>
                {ending ? "Ending…" : "End interview"}
              </button>
            </div>
          )}
          {remaining <= 0 && started && !ending && <p className="mt-2 text-sm text-bad">Time&apos;s up. Wrap up and end the interview.</p>}
          {notice && (
            <p className="mt-2 text-sm text-warn">
              {notice}{" "}
              <button className="underline" onClick={() => setNotice(null)}>
                Dismiss
              </button>
            </p>
          )}
        </div>

        {/* Transcript */}
        <div className="max-h-[40vh] min-h-40 overflow-y-auto border-b border-line p-4 text-sm lg:max-h-none lg:flex-1">
          {lines.length === 0 && !interim && <p className="text-muted">The conversation will appear here.</p>}
          <ul className="space-y-2">
            {lines.map((l) => (
              <li key={l.id} className={l.speaker === "interviewer" ? "" : "text-right"}>
                <span
                  className={`inline-block max-w-[90%] rounded-lg px-3 py-1.5 text-left ${
                    l.speaker === "interviewer" ? "bg-surface-2" : "bg-accent-soft"
                  }`}
                >
                  {l.text}
                </span>
              </li>
            ))}
            {interim && (
              <li className="text-right">
                <span className="inline-block max-w-[90%] rounded-lg bg-accent-soft px-3 py-1.5 text-left italic opacity-70">{interim}</span>
              </li>
            )}
          </ul>
          <div ref={transcriptEnd} />
        </div>
        {started && !ending && (
          <form
            className="flex gap-2 border-b border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              sendTyped();
            }}
          >
            <input className="input flex-1" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type to the interviewer…" />
            <button className="btn-secondary" disabled={!typed.trim()}>
              Send
            </button>
          </form>
        )}

        {/* Problem */}
        <details className="p-4 lg:max-h-[35vh] lg:overflow-y-auto" open>
          <summary className="cursor-pointer">
            <span className="font-semibold">{problem.title}</span> <DifficultyBadge difficulty={problem.difficulty} />{" "}
            <Tag tone="accent">{props.patternName}</Tag>
          </summary>
          <Markdown text={problem.statement} className="mt-3 text-sm" />
          {problem.constraints.length > 0 && (
            <ul className="mt-3 list-disc pl-5 font-mono text-xs text-muted">
              {problem.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </details>
      </section>

      <section className="flex min-h-[70vh] flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
          <select
            className="input w-auto py-1"
            value={lang}
            disabled={ending}
            onChange={(e) => {
              const l = e.target.value as Language;
              setLang(l);
              langRef.current = l;
              recorder.current?.push({ type: "marker", t: now(), payload: { what: "language", detail: l } });
              recorder.current?.snapshot(codeRef.current[l], l);
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          {!started && <span className="text-xs text-muted">Start the interview to talk with the interviewer.</span>}
          <div className="ml-auto flex gap-2">
            <button className="btn-secondary" disabled={!!running || ending} onClick={() => execute("sample")}>
              {running === "run" ? "Running…" : "Run"}
            </button>
            <button className="btn-primary" disabled={!!running || ending} onClick={() => execute("all")}>
              {running === "submit" ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
        <div className="min-h-[320px] flex-1">
          <Editor
            path={`mock-${sessionId}-${lang}`}
            language={lang}
            defaultValue={codeByLang[lang]}
            onChange={(v, ev) => {
              const code = v ?? "";
              codeRef.current[lang] = code;
              recorder.current?.edit(
                ev.changes.map((c) => ({ offset: c.rangeOffset, length: c.rangeLength, text: c.text })),
                code,
                lang,
              );
            }}
            theme={dark ? "vs-dark" : "light"}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              tabSize: lang === "python" ? 4 : 2,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: ending,
            }}
          />
        </div>
        <ResultsPanel outcome={outcome} running={running} runner={runner} lang={lang} />
      </section>
    </div>
  );
}
