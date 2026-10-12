// Code comprehension and debugging rounds (spec 4.5, the Google-style
// format): read an unfamiliar repo, explain it, and find and fix the bugs
// seeded in it, optionally with an AI assistant.

/** A bug already in the repo the candidate gets. */
export interface SeededBug {
  id: string;
  /** Where it lives, for the report. */
  file: string;
  /** What's wrong, revealed in the report. */
  description: string;
  /** The exact change that fixes it (buggy text → fixed text), for validation. */
  fix: { from: string; to: string };
  /** Hidden test names that fail while the bug is in place. */
  tests: string[];
  /** Word groups a good write-up of this bug mentions; each group is synonyms. */
  keywords: string[][];
}

/** A question about how the code works, answered in writing at the end. */
export interface ComprehensionQuestion {
  id: string;
  prompt: string;
  /** What a strong answer covers, shown in the report. */
  answer: string;
  /** Word groups a strong answer mentions; each group is synonyms. */
  keywords: string[][];
}

/** A canned answer for the offline helper, picked by prompt keywords. */
export interface HelperTopic {
  keywords: string[];
  reply: string;
}

export interface DebugTask {
  id: string;
  title: string;
  summary: string;
  modeledOn: string;
  /** Markdown brief shown in the workspace. */
  brief: string;
  /** The repo as the candidate gets it, bugs included. */
  files: Record<string, string>;
  entry: string;
  /** Test files the candidate can see and run (some fail at the start). */
  visibleTests: string[];
  /** Tests run only at the end; each seeded bug fails at least one. */
  hiddenTests: Record<string, string>;
  bugs: SeededBug[];
  questions: ComprehensionQuestion[];
  topics: HelperTopic[];
}

/** What the browser gets: no bug list, answers or canned replies. */
export interface PublicDebugTask {
  id: string;
  title: string;
  summary: string;
  modeledOn: string;
  brief: string;
  files: Record<string, string>;
  entry: string;
  visibleTests: string[];
  hiddenTests: Record<string, string>;
  bugCount: number;
  questions: { id: string; prompt: string }[];
}

export function toPublicDebugTask(t: DebugTask): PublicDebugTask {
  return {
    id: t.id,
    title: t.title,
    summary: t.summary,
    modeledOn: t.modeledOn,
    brief: t.brief,
    files: t.files,
    entry: t.entry,
    visibleTests: t.visibleTests,
    hiddenTests: t.hiddenTests,
    bugCount: t.bugs.length,
    questions: t.questions.map((q) => ({ id: q.id, prompt: q.prompt })),
  };
}

/** The repo with the given bugs fixed (all of them by default). */
export function applyFixes(task: DebugTask, ids: string[] = task.bugs.map((b) => b.id)): Record<string, string> {
  const files = { ...task.files };
  for (const b of task.bugs.filter((x) => ids.includes(x.id))) {
    const src = files[b.file];
    if (src === undefined || !src.includes(b.fix.from)) throw new Error(`Fix for ${b.id} doesn't apply to ${b.file}`);
    files[b.file] = src.replace(b.fix.from, b.fix.to);
  }
  return files;
}
