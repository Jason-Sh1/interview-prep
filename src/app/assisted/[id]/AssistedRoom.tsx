"use client";
import type { OnMount } from "@monaco-editor/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Editor, useDarkMode } from "@/components/CodeEditor";
import { Markdown } from "@/components/Markdown";
import { runRepoTests } from "@/lib/assisted/browser";
import { pastedFromAssistant } from "@/lib/assisted/paste";
import type { HarnessResult } from "@/lib/assisted/harness";
import type { PublicTask } from "@/lib/assisted/tasks";
import type { AssistedEvent } from "@/lib/assisted/types";
import { fmtClock } from "@/lib/interview/timeline";
import { finishAssistedAction } from "../actions";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  model: string;
}

interface Props {
  sessionId: string;
  task: PublicTask;
  minutes: number;
  models: { id: string; label: string }[];
  initialFiles: Record<string, string>;
  initialChat: ChatMessage[];
  elapsedAtRender: number;
}

const SNAPSHOT_DEBOUNCE_MS = 8_000;

export function AssistedRoom(props: Props) {
  const { sessionId, task } = props;
  const router = useRouter();
  const dark = useDarkMode();
  const [files, setFiles] = useState(props.initialFiles);
  const [active, setActive] = useState(task.entry);
  const [chat, setChat] = useState<ChatMessage[]>(props.initialChat);
  const [model, setModel] = useState(props.models[0].id);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<HarnessResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showBrief, setShowBrief] = useState(true);
  const [stage, setStage] = useState<"working" | "explaining" | "submitting">("working");
  const [explanation, setExplanation] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(props.elapsedAtRender);

  const filesRef = useRef(files);
  const chatRef = useRef(chat);
  const startRef = useRef(0);
  const dirty = useRef(false);
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => {
    chatRef.current = chat;
    // Scroll the chat panel itself, not the page.
    if (chatBox.current) chatBox.current.scrollTop = chatBox.current.scrollHeight;
  }, [chat]);

  // The session clock, anchored to the server's elapsed time at render.
  useEffect(() => {
    startRef.current = Date.now() - props.elapsedAtRender;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(id);
  }, [props.elapsedAtRender]);
  const now = () => Math.max(0, Math.round(Date.now() - startRef.current));
  const remaining = props.minutes * 60_000 - elapsed;

  const send = useCallback(
    (events: AssistedEvent[]) => {
      fetch(`/api/assisted/${sessionId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events }),
        keepalive: true,
      }).catch(() => setNotice("Couldn't save your latest changes; check your connection."));
    },
    [sessionId],
  );

  const snapshot = useCallback(() => {
    if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
    snapshotTimer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    send([{ type: "snapshot", t: now(), payload: { files: filesRef.current } }]);
  }, [send]);

  useEffect(() => {
    const flush = () => snapshot();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [snapshot]);

  function onEdit(path: string, value: string) {
    setFiles((f) => ({ ...f, [path]: value }));
    dirty.current = true;
    if (!snapshotTimer.current) snapshotTimer.current = setTimeout(snapshot, SNAPSHOT_DEBOUNCE_MS);
  }

  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const onMount: OnMount = (editor) => {
    editor.onDidPaste((e) => {
      const text = editor.getModel()?.getValueInRange(e.range) ?? "";
      if (!text.trim()) return;
      const fromAssistant = pastedFromAssistant(
        text,
        chatRef.current.filter((m) => m.role === "assistant").map((m) => m.text),
      );
      send([{ type: "paste", t: now(), payload: { path: activeRef.current, chars: text.length, fromAssistant } }]);
    });
  };

  async function runTests() {
    setRunning(true);
    const res = await runRepoTests(filesRef.current, task.visibleTests);
    setResults(res);
    setRunning(false);
    dirty.current = true;
    snapshot();
    send([{ type: "run", t: now(), payload: { passed: res.passed, total: res.total, failing: res.results.filter((r) => !r.passed).map((r) => r.name).slice(0, 100) } }]);
  }

  async function ask() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    setChat((c) => [...c, { role: "user", text, model }]);
    try {
      const res = await fetch(`/api/assisted/${sessionId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, model, files: filesRef.current }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error ?? "The assistant couldn't answer.");
      setChat((c) => [...c, { role: "assistant", text: data.reply!, model }]);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "The assistant couldn't answer.");
      setChat((c) => c.slice(0, -1));
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    setStage("submitting");
    snapshot();
    const final = filesRef.current;
    const res = await runRepoTests({ ...final, ...task.hiddenTests }, [...task.visibleTests, ...Object.keys(task.hiddenTests)]);
    try {
      await finishAssistedAction(sessionId, {
        files: final,
        explanation,
        tests: { passed: res.passed, total: res.total, failing: res.results.filter((r) => !r.passed).map((r) => r.name).slice(0, 100) },
      });
      router.refresh();
    } catch {
      setNotice("Couldn't finish the round. Try again.");
      setStage("explaining");
    }
  }

  const paths = Object.keys(files).sort((a, b) => Number(a.startsWith("tests/")) - Number(b.startsWith("tests/")) || a.localeCompare(b));

  return (
    <div className="grid flex-1 grid-cols-1 lg:h-[calc(100vh-3.5rem)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      {/* Repo: files, editor, tests */}
      <section className="flex min-h-[70vh] flex-col border-line lg:min-h-0 lg:border-r">
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
          {paths.map((p) => (
            <button
              key={p}
              onClick={() => setActive(p)}
              className={`rounded px-2 py-1 font-mono text-xs ${p === active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2"}`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="min-h-[320px] flex-1">
          <Editor
            path={active}
            language="javascript"
            value={files[active]}
            onChange={(v) => onEdit(active, v ?? "")}
            onMount={onMount}
            theme={dark ? "vs-dark" : "light"}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              tabSize: 2,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: stage !== "working",
            }}
          />
        </div>
        <div className="max-h-[35vh] overflow-y-auto border-t border-line p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondary" onClick={runTests} disabled={running || stage !== "working"}>
              {running ? "Running…" : "Run tests"}
            </button>
            {results && !results.error && (
              <span className={results.passed === results.total ? "text-good" : "text-bad"}>
                {results.passed} / {results.total} passing
              </span>
            )}
            <span className="ml-auto text-xs text-muted">Runs {task.visibleTests.join(", ")}. More tests run when you finish.</span>
          </div>
          {results?.error && <p className="mt-2 text-bad">{results.error}</p>}
          {results && (
            <ul className="mt-2 space-y-1">
              {results.results.map((r, i) => (
                <li key={i} className="font-mono text-xs">
                  <span className={r.passed ? "text-good" : "text-bad"}>{r.passed ? "✓" : "✗"}</span> {r.name}
                  {r.error && <div className="ml-4 whitespace-pre-wrap text-bad">{r.error}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Brief and assistant */}
      <section className="flex min-h-[70vh] flex-col lg:min-h-0">
        <div className="border-b border-line p-4">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold">{task.title}</h1>
            <button className="text-xs text-accent hover:underline" onClick={() => setShowBrief((s) => !s)}>
              {showBrief ? "Hide brief" : "Show brief"}
            </button>
            <span className={`ml-auto font-mono text-lg tabular-nums ${remaining <= 120_000 ? "text-bad" : ""}`}>{fmtClock(Math.max(0, remaining))}</span>
            {stage === "working" && (
              <button className="btn-primary" onClick={() => setStage("explaining")}>
                Finish
              </button>
            )}
          </div>
          {remaining <= 0 && stage === "working" && <p className="mt-1 text-sm text-bad">Time&apos;s up. Finish and explain your change.</p>}
          {showBrief && (
            <div className="mt-3 max-h-[30vh] overflow-y-auto text-sm">
              <Markdown text={task.brief} />
            </div>
          )}
        </div>

        {stage === "working" ? (
          <>
            <div ref={chatBox} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              {chat.length === 0 && (
                <p className="text-muted">
                  Ask the assistant anything about the repo or the task. Interviewers watch how you prompt: name files and functions, say what the
                  code should do, and check what comes back.
                </p>
              )}
              {chat.map((m, i) => (
                <div key={i} className={m.role === "user" ? "ml-8 rounded-lg bg-accent-soft p-3" : "mr-4 rounded-lg bg-surface-2 p-3"}>
                  <div className="mb-1 text-xs text-muted">{m.role === "user" ? "You" : props.models.find((x) => x.id === m.model)?.label ?? "Assistant"}</div>
                  {m.role === "user" ? <p className="whitespace-pre-wrap">{m.text}</p> : <Markdown text={m.text} />}
                </div>
              ))}
              {sending && <p className="animate-pulse text-muted">The assistant is thinking…</p>}
            </div>
            <div className="border-t border-line p-3">
              {notice && <p className="mb-2 text-sm text-warn">{notice}</p>}
              <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                <label htmlFor="model">Model</label>
                <select id="model" className="input w-auto py-1 text-xs" value={model} onChange={(e) => setModel(e.target.value)} disabled={props.models.length < 2}>
                  {props.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask();
                }}
                className="flex gap-2"
              >
                <textarea
                  className="input min-h-[64px] flex-1"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask();
                    }
                  }}
                  placeholder="Ask the assistant (Enter to send, Shift+Enter for a new line)"
                  aria-label="Message to the assistant"
                />
                <button className="btn-primary self-end" disabled={sending || !draft.trim()}>
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            <h2 className="font-semibold">Explain your change</h2>
            <p className="mt-1 text-muted">
              As in the real round, you finish by owning the code. Say what you changed and in which files, why you chose this design, how you
              verified it, and anything the assistant got wrong that you fixed.
            </p>
            <textarea
              className="input mt-3 min-h-[200px] w-full"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              disabled={stage === "submitting"}
              aria-label="Your explanation"
            />
            {notice && <p className="mt-2 text-warn">{notice}</p>}
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={submit} disabled={stage === "submitting"}>
                {stage === "submitting" ? "Running the full test suite…" : "Submit and see my report"}
              </button>
              <button className="btn-ghost" onClick={() => setStage("working")} disabled={stage === "submitting"}>
                Back to the code
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
