"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Tag } from "@/components/badges";
import { COMPETENCIES, competencyLabel, suggestCompetencies, type CompetencyId } from "@/lib/behavioral/competencies";
import { checkStory, storyText, type StoryFields } from "@/lib/behavioral/star";
import { deleteStoryAction, saveStoryAction } from "../actions";

export interface StoryView extends StoryFields {
  id: number;
  origin: "resume" | "manual" | "round";
}

const ORIGIN = { resume: "From resume", manual: "Written", round: "From a round" } as const;
const EMPTY: StoryFields = { title: "", situation: "", task: "", action: "", result: "", competencies: [] };

const FIELDS: { key: "situation" | "task" | "action" | "result"; label: string; help: string; rows: number }[] = [
  { key: "situation", label: "Situation", help: "Where and when, and what was at stake. One or two sentences.", rows: 3 },
  { key: "task", label: "Task", help: "Your goal or responsibility.", rows: 2 },
  { key: "action", label: "Action", help: "What you did, step by step, in the first person. Most of the story.", rows: 6 },
  { key: "result", label: "Result", help: "How it ended, with numbers. Add what you learned.", rows: 3 },
];

function StoryEditor({ id, initial, onDone }: { id: number | null; initial: StoryFields; onDone: (savedId?: number) => void }) {
  const [s, setS] = useState<StoryFields>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const checks = useMemo(() => checkStory(s), [s]);
  const suggested = useMemo(() => suggestCompetencies(storyText(s), 3).filter((c) => !s.competencies.includes(c)), [s]);
  const passed = checks.filter((c) => c.ok).length;

  const toggle = (c: CompetencyId) =>
    setS((x) => ({ ...x, competencies: x.competencies.includes(c) ? x.competencies.filter((y) => y !== c) : [...x.competencies, c].slice(0, 6) }));

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveStoryAction(id, { ...s, competencies: s.competencies as CompetencyId[] });
      if (r.error) return setError(r.error);
      onDone(r.id);
    });

  return (
    <div className="card mt-3 grid gap-4 p-4 text-sm lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="story-title">
            Title
          </label>
          <input id="story-title" className="input" value={s.title} maxLength={120} onChange={(e) => setS({ ...s, title: e.target.value })} />
        </div>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label" htmlFor={`story-${f.key}`}>
              {f.label} <span className="font-normal text-muted">· {f.help}</span>
            </label>
            <textarea id={`story-${f.key}`} className="input" rows={f.rows} value={s[f.key]} onChange={(e) => setS({ ...s, [f.key]: e.target.value })} />
          </div>
        ))}
        <div>
          <div className="label">Competencies it shows</div>
          <div className="flex flex-wrap gap-1.5">
            {COMPETENCIES.map((c) => {
              const on = s.competencies.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  title={c.help}
                  aria-pressed={on}
                  onClick={() => toggle(c.id)}
                  className={`rounded border px-2 py-0.5 text-xs ${on ? "border-accent bg-accent-soft text-accent" : suggested.includes(c.id) ? "border-dashed border-accent text-accent" : "border-line text-muted"}`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {suggested.length > 0 && <p className="mt-1 text-xs text-muted">Suggested from the text (dashed): {suggested.map(competencyLabel).join(", ")}.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save story"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => onDone()} disabled={pending}>
            Cancel
          </button>
          {error && <span className="text-bad">{error}</span>}
        </div>
      </div>
      <div>
        <div className="font-medium">
          Checks <span className="text-muted">({passed} of {checks.length})</span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              <span className={c.ok ? "text-good" : "text-warn"} aria-label={c.ok ? "passes" : "needs work"}>
                {c.ok ? "✓" : "•"}
              </span>
              <span>
                {c.label}
                {!c.ok && c.hint && <span className="block text-xs text-muted">{c.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The story list with an inline STAR editor. */
export function StoryBank({ stories, editId }: { stories: StoryView[]; editId: number | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | "new" | null>(editId && stories.some((s) => s.id === editId) ? editId : null);
  const [pending, start] = useTransition();

  const done = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className="btn-primary" onClick={() => setEditing("new")} disabled={editing === "new"}>
          New story
        </button>
        <span className="text-sm text-muted">{stories.length ? `${stories.length} ${stories.length === 1 ? "story" : "stories"}` : "No stories yet."}</span>
      </div>
      {editing === "new" && <StoryEditor id={null} initial={EMPTY} onDone={done} />}
      <ul className="mt-3 space-y-3">
        {stories.map((s) => {
          if (editing === s.id) return <li key={s.id}><StoryEditor id={s.id} initial={s} onDone={done} /></li>;
          const checks = checkStory(s);
          const failing = checks.filter((c) => !c.ok);
          return (
            <li key={s.id} id={`story-${s.id}`} className="card p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.title}</span>
                <Tag>{ORIGIN[s.origin]}</Tag>
                {s.competencies.map((c) => (
                  <Tag key={c} tone="accent">
                    {competencyLabel(c)}
                  </Tag>
                ))}
                <span className={`ml-auto text-xs ${failing.length ? "text-warn" : "text-good"}`}>
                  {checks.length - failing.length} of {checks.length} checks
                </span>
              </div>
              {(s.action || s.result) && (
                <p className="mt-1 line-clamp-2 text-muted">
                  {s.action} {s.result}
                </p>
              )}
              {failing.length > 0 && <p className="mt-1 text-xs text-warn">To do: {failing.slice(0, 3).map((c) => c.label.toLowerCase()).join("; ")}.</p>}
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => setEditing(s.id)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost text-bad"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Delete "${s.title}"?`)) return;
                    start(async () => {
                      await deleteStoryAction(s.id);
                      router.refresh();
                    });
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
