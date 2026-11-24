import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { COMPETENCIES, COMPETENCY_IDS } from "./competencies";
import type { StoryDraft } from "./resume";

// Claude for the story bank: drafts STAR stories from a resume. Only used when
// ANTHROPIC_API_KEY is set; resume.ts is the fallback.

export const STORY_MODEL = process.env.STORY_MODEL || "claude-sonnet-5-5";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const draftsSchema = z.object({
  stories: z
    .array(
      z.object({
        title: z.string().describe("A short title the candidate will recognize, under 70 characters"),
        situation: z.string().describe("One or two sentences of context from the resume; empty if unknown"),
        task: z.string().describe("The goal or responsibility, if the resume implies it; empty if unknown"),
        action: z.string().describe("What the candidate did, in the first person, from the resume only"),
        result: z.string().describe("The outcome with any numbers the resume gives; empty if none"),
        competencies: z.array(z.enum(COMPETENCY_IDS)).describe("One to three competencies the story could show"),
      }),
    )
    .describe("Up to ten story seeds, strongest first"),
});

export async function claudeDraftStories(resume: string): Promise<StoryDraft[]> {
  const res = await getClient().beta.messages.parse({
    model: STORY_MODEL,
    max_tokens: 6000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(draftsSchema) },
    system: `You help a software engineer prepare for behavioral interviews. From their resume, draft up to ten STAR story seeds they could tell, preferring bullets with clear actions and measurable results, and covering different competencies. Use only facts in the resume: never invent numbers, names or outcomes; leave a field empty when the resume doesn't say. Write actions in the first person. Competencies: ${COMPETENCIES.map((c) => `${c.id} (${c.label})`).join(", ")}.`,
    messages: [{ role: "user", content: `Resume:\n\n${resume.slice(0, 30_000)}` }],
  });
  const out = res.parsed_output;
  if (!out) throw new Error("No stories returned");
  return out.stories.slice(0, 10).map((s) => ({ ...s, competencies: s.competencies.slice(0, 3) }));
}
