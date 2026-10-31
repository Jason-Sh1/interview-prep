"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import type { BehavioralExtra } from "@/lib/behavioral/grade";
import { splitIntoStar } from "@/lib/behavioral/star";
import { competencyLabel, suggestCompetencies } from "@/lib/behavioral/competencies";
import { QUESTION_BY_ID } from "@/lib/behavioral/questions";
import {
  addDrafts,
  behavioralStartArtifact,
  createStory,
  deleteStory,
  draftFromResume,
  getResume,
  saveResume,
  storyInputSchema,
  updateStory,
  type StoryInput,
} from "@/lib/behavioral/stories";
import { COMPANY_BY_ID } from "@/lib/engine/companies";
import { PERSONAS } from "@/lib/interview/types";
import { createRound, getRound } from "@/lib/rounds";
import { getGoals } from "@/lib/track";

const startSchema = z.object({
  topic: z.string().min(1).max(100),
  minutes: z.coerce.number().pipe(z.union([z.literal(20), z.literal(30), z.literal(45)])),
  persona: z.enum(PERSONAS),
  company: z
    .string()
    .max(40)
    .transform((c) => (c && COMPANY_BY_ID[c] ? c : null)),
});

/** Starts a behavioral round with its questions and a snapshot of your story bank. */
export async function startBehavioralRoundAction(form: FormData) {
  const user = await requireUser();
  const p = startSchema.parse({ topic: form.get("topic"), minutes: form.get("minutes"), persona: form.get("persona") ?? "neutral", company: form.get("company") ?? "" });
  const goals = await getGoals(user.id);
  const artifact = await behavioralStartArtifact(user.id, p.topic, p.minutes, p.company);
  const id = await createRound(
    user.id,
    "behavioral",
    p.topic,
    { minutes: p.minutes, persona: p.persona, company: p.company, level: goals?.level ?? "mid" },
    artifact,
  );
  redirect(`/behavioral/${id}`);
}

type Result = { error?: string };
const message = (e: unknown) => (e instanceof z.ZodError ? (e.issues[0]?.message ?? "Check the fields.") : e instanceof Error ? e.message : "Something went wrong.");

export async function saveResumeTextAction(text: string): Promise<Result> {
  const user = await requireUser();
  if (typeof text !== "string" || text.trim().length < 50) return { error: "Paste at least a few lines of your resume." };
  await saveResume(user.id, text, null);
  revalidatePath("/behavioral/stories");
  return {};
}

export async function draftStoriesAction(): Promise<Result & { added?: number; generator?: "claude" | "heuristic" }> {
  const user = await requireUser();
  const resume = await getResume(user.id);
  if (!resume?.text) return { error: "Add your resume first." };
  const { drafts, generator } = await draftFromResume(resume.text);
  if (!drafts.length) return { error: "No bullets with action verbs found to draft from. Write a story by hand instead.", generator };
  try {
    const added = await addDrafts(user.id, drafts);
    revalidatePath("/behavioral/stories");
    return { added, generator };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function saveStoryAction(id: number | null, input: StoryInput): Promise<Result & { id?: number }> {
  const user = await requireUser();
  try {
    const s = storyInputSchema.parse(input);
    if (id === null) {
      const newId = await createStory(user.id, s, "manual");
      revalidatePath("/behavioral/stories");
      return { id: newId };
    }
    await updateStory(user.id, id, s);
    revalidatePath("/behavioral/stories");
    return { id };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function deleteStoryAction(id: number): Promise<void> {
  const user = await requireUser();
  await deleteStory(user.id, z.number().int().parse(id));
  revalidatePath("/behavioral/stories");
}

/** Saves one of a round's answers to the story bank, split roughly into STAR, for editing. */
export async function saveAnswerAsStoryAction(roundId: string, questionId: string): Promise<Result & { id?: number }> {
  const user = await requireUser();
  const round = await getRound(roundId, user.id);
  const extra = round?.report?.extra as BehavioralExtra | undefined;
  const q = extra?.questions.find((x) => x.id === questionId);
  if (!round || round.kind !== "behavioral" || !q?.answer.trim()) return { error: "That answer isn't available." };
  const star = splitIntoStar(q.answer);
  const question = QUESTION_BY_ID.get(questionId);
  const title = `${question?.competencies.length ? `${competencyLabel(question.competencies[0])}: ` : ""}${q.answer.split(/[.!?]/)[0].trim().split(/\s+/).slice(0, 8).join(" ")}`.slice(0, 120);
  try {
    const id = await createStory(
      user.id,
      {
        title: title || "Story from a behavioral round",
        situation: star.situation.slice(0, 4_000),
        task: star.task.slice(0, 4_000),
        action: star.action.slice(0, 8_000),
        result: star.result.slice(0, 4_000),
        competencies: [...new Set([...(question?.competencies ?? []), ...suggestCompetencies(q.answer, 2)])].slice(0, 3) as StoryInput["competencies"],
      },
      "round",
    );
    revalidatePath("/behavioral/stories");
    return { id };
  } catch (e) {
    return { error: message(e) };
  }
}
