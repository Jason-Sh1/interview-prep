import "server-only";
// The story bank and resume in the database, plus what a behavioral round
// needs from them: drafting stories from the resume (Claude with a key, the
// resume heuristic without), and the story snapshot a new round starts with.

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, ensureMigrated, schema } from "../db";
import { claudeEnabled } from "../interview/claude";
import { summarizeStory, type BehavioralArtifact } from "./artifact";
import { claudeDraftStories } from "./claude";
import { COMPETENCY_IDS } from "./competencies";
import { pickQuestions } from "./questions";
import { draftStoriesFromResume, MAX_RESUME_CHARS, type StoryDraft } from "./resume";

export interface Story {
  id: number;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  competencies: string[];
  origin: "resume" | "manual" | "round";
  createdAt: Date;
  updatedAt: Date;
}

export const storyInputSchema = z.object({
  title: z.string().trim().min(1, "Give the story a title").max(120),
  situation: z.string().max(4_000),
  task: z.string().max(4_000),
  action: z.string().max(8_000),
  result: z.string().max(4_000),
  competencies: z.array(z.enum(COMPETENCY_IDS)).max(6),
});
export type StoryInput = z.infer<typeof storyInputSchema>;

const MAX_STORIES = 60;

export async function listStories(userId: string): Promise<Story[]> {
  await ensureMigrated();
  const rows = await db.select().from(schema.stories).where(eq(schema.stories.userId, userId)).orderBy(asc(schema.stories.createdAt), asc(schema.stories.id));
  return rows.map((r) => ({ ...r, origin: r.origin as Story["origin"] }));
}

export async function createStory(userId: string, input: StoryInput, origin: Story["origin"] = "manual"): Promise<number> {
  await ensureMigrated();
  const existing = await db.$count(schema.stories, eq(schema.stories.userId, userId));
  if (existing >= MAX_STORIES) throw new Error(`The story bank holds up to ${MAX_STORIES} stories. Delete one first.`);
  const s = storyInputSchema.parse(input);
  const [row] = await db.insert(schema.stories).values({ userId, ...s, origin }).returning({ id: schema.stories.id });
  return row.id;
}

export async function updateStory(userId: string, id: number, input: StoryInput): Promise<void> {
  const s = storyInputSchema.parse(input);
  await db
    .update(schema.stories)
    .set({ ...s, updatedAt: new Date() })
    .where(and(eq(schema.stories.id, id), eq(schema.stories.userId, userId)));
}

export async function deleteStory(userId: string, id: number): Promise<void> {
  await db.delete(schema.stories).where(and(eq(schema.stories.id, id), eq(schema.stories.userId, userId)));
}

export async function getResume(userId: string): Promise<{ text: string; fileName: string | null; updatedAt: Date } | null> {
  await ensureMigrated();
  const [row] = await db.select().from(schema.resumes).where(eq(schema.resumes.userId, userId));
  return row ? { text: row.text, fileName: row.fileName, updatedAt: row.updatedAt } : null;
}

export async function saveResume(userId: string, text: string, fileName: string | null): Promise<void> {
  await ensureMigrated();
  const clean = text.replace(/\u0000/g, "").slice(0, MAX_RESUME_CHARS).trim();
  await db
    .insert(schema.resumes)
    .values({ userId, text: clean, fileName })
    .onConflictDoUpdate({ target: schema.resumes.userId, set: { text: clean, fileName, updatedAt: new Date() } });
}

/** Story drafts from the saved resume: Claude with a key (falling back on failure), the heuristic without. */
export async function draftFromResume(resumeText: string): Promise<{ drafts: StoryDraft[]; generator: "claude" | "heuristic" }> {
  if (claudeEnabled()) {
    try {
      const drafts = await claudeDraftStories(resumeText);
      if (drafts.length) return { drafts, generator: "claude" };
    } catch (e) {
      console.error("Claude story drafting failed; using the resume heuristic", e);
    }
  }
  return { drafts: draftStoriesFromResume(resumeText), generator: "heuristic" };
}

/** Adds drafts to the bank, skipping titles already there. Returns how many were added. */
export async function addDrafts(userId: string, drafts: StoryDraft[]): Promise<number> {
  const have = new Set((await listStories(userId)).map((s) => s.title.trim().toLowerCase()));
  let added = 0;
  for (const d of drafts) {
    const key = d.title.trim().toLowerCase();
    if (!key || have.has(key) || have.size >= MAX_STORIES) continue;
    const input = storyInputSchema.safeParse({ ...d, title: d.title.slice(0, 120), competencies: d.competencies.filter((c) => (COMPETENCY_IDS as readonly string[]).includes(c)).slice(0, 6) });
    if (!input.success) continue;
    await createStory(userId, input.data, "resume");
    have.add(key);
    added++;
  }
  return added;
}

/** The artifact a new behavioral round starts with: its questions and a snapshot of the story bank. */
export async function behavioralStartArtifact(userId: string, topicId: string, minutes: number, company: string | null): Promise<BehavioralArtifact> {
  const stories = await listStories(userId);
  return {
    questionIds: pickQuestions(topicId, minutes, company),
    stories: stories.slice(0, 60).map((s) => ({ id: s.id, title: s.title.slice(0, 200), summary: summarizeStory(s), competencies: s.competencies.slice(0, 8) })),
    notes: "",
  };
}
