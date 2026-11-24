"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { draftStoriesAction, saveResumeTextAction } from "../actions";

/** Paste or upload a resume, then draft stories from it. */
export function ResumeForm({ initialText, fileName, usesClaude }: { initialText: string; fileName: string | null; usesClaude: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [open, setOpen] = useState(!initialText);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const saved = initialText.trim().length > 0;

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setStatus(null);
      try {
        await fn();
      } catch {
        setStatus({ tone: "bad", text: "Something went wrong. Try again." });
      }
    });

  const saveText = () =>
    run(async () => {
      const r = await saveResumeTextAction(text);
      if (r.error) return setStatus({ tone: "bad", text: r.error });
      setStatus({ tone: "good", text: "Resume saved." });
      setOpen(false);
      router.refresh();
    });

  const upload = (f: File) =>
    run(async () => {
      if (f.size > 5 * 1024 * 1024) return setStatus({ tone: "bad", text: "That PDF is over 5 MB." });
      const body = new FormData();
      body.set("file", f);
      const res = await fetch("/api/behavioral/resume", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { error?: string; chars?: number };
      if (!res.ok) return setStatus({ tone: "bad", text: data.error ?? "Couldn't read that PDF." });
      setStatus({ tone: "good", text: `Read ${data.chars?.toLocaleString()} characters from ${f.name}.` });
      setOpen(false);
      router.refresh();
    });

  const draft = () =>
    run(async () => {
      const r = await draftStoriesAction();
      if (r.error) return setStatus({ tone: "bad", text: r.error });
      setStatus({
        tone: "good",
        text: r.added
          ? `Added ${r.added} draft ${r.added === 1 ? "story" : "stories"}${r.generator === "claude" ? " written by Claude" : " from your resume bullets"}. Fill in the gaps below.`
          : "No new stories: the drafts match ones already in your bank.",
      });
      router.refresh();
    });

  return (
    <div className="card mt-3 p-4 text-sm">
      {saved && !open ? (
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Resume saved{fileName ? ` from ${fileName}` : ""} ({initialText.length.toLocaleString()} characters).
          </span>
          <button type="button" className="btn-secondary" onClick={() => setOpen(true)} disabled={pending}>
            Replace
          </button>
          <button type="button" className="btn-primary" onClick={draft} disabled={pending}>
            {pending ? "Working…" : "Draft stories from my resume"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="resume-text">
              Paste your resume as text
            </label>
            <textarea
              id="resume-text"
              className="input h-48 font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Software Engineer | Acme | 2022 - Present\n- Led the migration of billing to a new queue, cutting failed charges by 30%\n- ..."}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" onClick={saveText} disabled={pending || text.trim().length < 50}>
              Save text
            </button>
            <span className="text-muted">or</span>
            <input
              ref={file}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              aria-label="Upload a PDF resume"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn-secondary" onClick={() => file.current?.click()} disabled={pending}>
              Upload a PDF (up to 5 MB)
            </button>
            {saved && (
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
            )}
            {pending && <span className="text-muted">Working…</span>}
          </div>
          <p className="text-xs text-muted">Only the text is kept. {usesClaude ? "Claude drafts stories from it." : "Stories are drafted from bullets that start with an action verb (set ANTHROPIC_API_KEY to have Claude draft them)."}</p>
        </div>
      )}
      {status && <p className={`mt-2 ${status.tone === "good" ? "text-good" : "text-bad"}`}>{status.text}</p>}
    </div>
  );
}
