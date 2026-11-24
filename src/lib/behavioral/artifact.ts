// What a behavioral round carries besides the conversation: the questions
// picked for it, a snapshot of the candidate's stories (so the interviewer can
// probe them), and their scratch notes. Safe to import from the browser.
import { z } from "zod";
import { competencyLabel } from "./competencies";
import { QUESTION_BY_ID } from "./questions";

export const roundStorySchema = z.object({
  id: z.number().int(),
  title: z.string().max(200),
  /** A short STAR summary. */
  summary: z.string().max(1_500),
  competencies: z.array(z.string().max(40)).max(8),
});
export type RoundStory = z.infer<typeof roundStorySchema>;

export const behavioralArtifactSchema = z.object({
  questionIds: z.array(z.string().max(60)).max(12),
  stories: z.array(roundStorySchema).max(60),
  notes: z.string().max(20_000),
});
export type BehavioralArtifact = z.infer<typeof behavioralArtifactSchema>;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** A one-paragraph STAR summary of a story for the interviewer. */
export function summarizeStory(s: { situation: string; task: string; action: string; result: string }): string {
  return clip(
    [s.situation && `S: ${clip(s.situation.trim(), 220)}`, s.task && `T: ${clip(s.task.trim(), 160)}`, s.action && `A: ${clip(s.action.trim(), 400)}`, s.result && `R: ${clip(s.result.trim(), 220)}`]
      .filter(Boolean)
      .join(" "),
    1_400,
  );
}

/** The artifact as text for the Claude interviewer and grader. */
export function describeBehavioral(a: BehavioralArtifact): string {
  const lines: string[] = [];
  const qs = a.questionIds.flatMap((id) => (QUESTION_BY_ID.has(id) ? [QUESTION_BY_ID.get(id)!] : []));
  if (qs.length) lines.push(`Questions planned for this round, in order:\n${qs.map((q, i) => `${i + 1}. ${q.text}`).join("\n")}`);
  if (a.stories.length) {
    lines.push(
      `The candidate's story bank (${a.stories.length}):\n${a.stories
        .slice(0, 30)
        .map((s) => `- "${s.title}"${s.competencies.length ? ` [${s.competencies.map(competencyLabel).join(", ")}]` : ""}${s.summary ? `: ${s.summary}` : ""}`)
        .join("\n")}`,
    );
  } else lines.push("The candidate has no stories in their story bank yet.");
  if (a.notes.trim()) lines.push(`Candidate's notes:\n${a.notes.trim().slice(0, 4_000)}`);
  return lines.join("\n\n");
}
