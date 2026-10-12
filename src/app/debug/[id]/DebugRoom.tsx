"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Editor, useDarkMode } from "@/components/CodeEditor";
import { Markdown } from "@/components/Markdown";
import { runRepoTests } from "@/lib/assisted/browser";
import type { HarnessResult } from "@/lib/assisted/harness";
import type { DebugAssistant } from "@/lib/comprehension";
import type { PublicDebugTask } from "@/lib/comprehension/types";
import { fmtClock } from "@/lib/interview/timeline";
import { finishDebugAction } from "../actions";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface Props {
  roundId: string;
  task: PublicDebugTask;
  minutes: number;
  assistant: DebugAssistant;
  initialFiles: Record<string, string>;
  initialChat: ChatMessage[];
  elapsedAtRender: number;
}

const SAVE_DEBOUNCE_MS = 8_000;

export function DebugRoom(props: Props) {
  const { roundId, task } = props;
  const router = useRouter();
  const dark = useDarkMode();
  const [files, setFiles] = useState(props.initialFiles);
  const [active, setActive] = useState(task.entry);
  const [chat, setChat] = useState<ChatMessage[]>(props.initialChat);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<HarnessResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showBrief, setShowBrief] = useState(true);
  const [stage, setStage] = useState<"working" | "writing" | "submitting">("working");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(props.elapsedAtRender);

  const filesRef = useRef(files);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => {
    if (chatBox.current) chatBox.current.scrollTop = chatBox.current.scrollHeight;
  }, [chat]);

  // Written answers live in this browser until submitted, so a reload doesn't lose them.
  const draftKey = `debug:${roundId}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) ?? "null") as { answers?: Record<string, string>; notes?: string } | null;
      // localStorage is only readable after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved?.answers) setAnswers(saved.answers);
      if (saved?.notes) setNotes(saved.notes);
    } catch {
      /* storage unavailable */
    }
  }, [draftKey]);
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers, notes }));
    } catch {
      /* storage unavailable */
    }
  }, [draftKey, answers, notes]);

  useEffect(() => {
    const start = Date.now() - props.elapsedAtRender;
    const id = setInterval(() => setElapsed(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [props.elapsedAtRender]);
  const remaining = props.minutes * 60_000 - elapsed;

  const post = useCallback(
    (body: { files?: Record<string, string>; run?: { passed: number; total: number } }) => {
      fetch(`/api/debug/${roundId}/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => setNotice("Couldn't save your latest changes; check your connection."));
    },
    [roundId],
  );

  const save = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    post({ files: filesRef.current });
  }, [post]);

  useEffect(() => {
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [save]);

  function onEdit(path: string, value: string) {
    setFiles((f) => ({ ...f, [path]: value }));
    dirty.current = true;
    if (!saveTimer.current) saveTimer.current = setTimeout(save, SAVE_DEBOUNCE_MS);
  }

  async function runTests() {
    setRunning(true);
    const res = await runRepoTests(filesRef.current, task.visibleTests);
    setResults(res);
    setRunning(false);
    dirty.current = false;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    post({ files: filesRef.current, run: { passed: res.passed, total: res.total } });
  }

  async function ask() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    setChat((c) => [...c, { role: "user", text }]);
    try {
      const res = await fetch(`/api/debug/${roundId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, files: filesRef.current }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error ?? "The assistant couldn't answer.");
      setChat((c) => [...c, { role: "assistant", text: data.reply! }]);
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
    const final = filesRef.current;
    // The full suite, hidden tests included, runs here in the browser, like the visible one.
    const res = await runRepoTests({ ...final, ...task.hiddenTests }, [...task.visibleTests, ...Object.keys(task.hiddenTests)]);
    try {
      await finishDebugAction(roundId, {
        files: final,
        answers,
        notes,
        tests: { passed: res.passed, total: res.total, failing: res.results.filter((r) => !r.passed).map((r) => r.name).slice(0, 100) },
      });
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* storage unavailable */
      }
      router.refresh();
    } catch {
      setNotice("Couldn't finish the round. Try again.");
      setStage("writing");
    }
  }

  const paths = Object.keys(files).sort((a, b) => Number(a.startsWith("tests/")) - Number(b.startsWith("tests/")) || a.localeCompare(b));
  const unanswered = task.questions.filter((q) => !answers[q.id]?.trim()).length;

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
            path={`debug-${roundId}/${active}`}
            language="javascript"
            value={files[active]}
            onChange={(v) => onEdit(active, v ?? "")}
            theme={dark ? "vs-dark" : "light"}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              tabSize: 2,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: stage === "submitting",
            }}
          />
        </div>
        <div className="max-h-[35vh] overflow-y-auto border-t border-line p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondary" onClick={runTests} disabled={running || stage === "submitting"}>
              {running ? "Running…" : "Run tests"}
            </button>
            {results && !results.error && (
              <span className={results.passed === results.total ? "text-good" : "text-bad"}>
                {results.passed} / {results.total} passing
              </span>
            )}
            <span className="ml-auto text-xs text-muted">You can add tests to {task.visibleTests.join(", ")}. Hidden tests run when you finish.</span>
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

      {/* Brief, assistant, and the write-up */}
      <section className="flex min-h-[70vh] flex-col lg:min-h-0">
        <div className="border-b border-line p-4">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold">{task.title}</h1>
            <button className="text-xs text-accent hover:underline" onClick={() => setShowBrief((s) => !s)}>
              {showBrief ? "Hide brief" : "Show brief"}
            </button>
            <span className={`ml-auto font-mono text-lg tabular-nums ${remaining <= 120_000 ? "text-bad" : ""}`}>{fmtClock(Math.max(0, remaining))}</span>
            {stage === "working" && (
              <button className="btn-primary" onClick={() => setStage("writing")}>
                Finish
              </button>
            )}
          </div>
          {remaining <= 0 && stage === "working" && <p className="mt-1 text-sm text-bad">Time&apos;s up. Finish and write up what you found.</p>}
          {showBrief && (
            <div className="mt-3 max-h-[30vh] overflow-y-auto text-sm">
              <Markdown text={task.brief} />
            </div>
          )}
        </div>

        {stage === "working" ? (
          props.assistant === "none" ? (
            <div className="flex-1 p-4 text-sm text-muted">
              <p>No assistant this round: just you and the code. Read the entry point first, then run the tests.</p>
              <p className="mt-2">The questions you&apos;ll answer at the end:</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                {task.questions.map((q) => (
                  <li key={q.id}>{q.prompt}</li>
                ))}
              </ol>
            </div>
          ) : (
            <>
              <div ref={chatBox} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
                {chat.length === 0 && (
                  <p className="text-muted">
                    Ask the assistant to explain code or help you reason about a failure. It won&apos;t hand you the bugs; interviewers watch
                    whether you can find them and how you use the help.
                  </p>
                )}
                {chat.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "ml-8 rounded-lg bg-accent-soft p-3" : "mr-4 rounded-lg bg-surface-2 p-3"}>
                    <div className="mb-1 text-xs text-muted">{m.role === "user" ? "You" : props.assistant === "claude" ? "Claude" : "Helper"}</div>
                    {m.role === "user" ? <p className="whitespace-pre-wrap">{m.text}</p> : <Markdown text={m.text} />}
                  </div>
                ))}
                {sending && <p className="animate-pulse text-muted">The assistant is thinking…</p>}
              </div>
              <div className="border-t border-line p-3">
                {notice && <p className="mb-2 text-sm text-warn">{notice}</p>}
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
                    placeholder="Ask about the code (Enter to send, Shift+Enter for a new line)"
                    aria-label="Message to the assistant"
                  />
                  <button className="btn-primary self-end" disabled={sending || !draft.trim()}>
                    Send
                  </button>
                </form>
              </div>
            </>
          )
        ) : (
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            <h2 className="font-semibold">Explain the code</h2>
            <p className="mt-1 text-muted">Answer as you would out loud to the interviewer: short and specific.</p>
            {task.questions.map((q, i) => (
              <label key={q.id} className="mt-3 block">
                <span className="font-medium">
                  {i + 1}. {q.prompt}
                </span>
                <textarea
                  className="input mt-1 min-h-[80px] w-full"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  disabled={stage === "submitting"}
                />
              </label>
            ))}
            <h2 className="mt-6 font-semibold">The bugs you found</h2>
            <p className="mt-1 text-muted">
              There {task.bugCount === 1 ? "was 1 bug" : `were ${task.bugCount} bugs`}. For each one you found: the symptom, the root cause, your fix,
              and how you checked it.
            </p>
            <textarea
              className="input mt-2 min-h-[160px] w-full"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={stage === "submitting"}
              aria-label="Your write-up of the bugs"
            />
            {notice && <p className="mt-2 text-warn">{notice}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn-primary" onClick={submit} disabled={stage === "submitting"}>
                {stage === "submitting" ? "Running the hidden tests…" : "Submit and see my report"}
              </button>
              <button className="btn-ghost" onClick={() => setStage("working")} disabled={stage === "submitting"}>
                Back to the code
              </button>
              {unanswered > 0 && stage === "writing" && <span className="text-xs text-muted">{unanswered} question{unanswered === 1 ? "" : "s"} unanswered</span>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
