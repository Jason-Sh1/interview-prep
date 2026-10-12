// AI-assisted coding rounds (spec 4.5): a small multi-file repo, a chat
// assistant, and grading on how the candidate used it.
import { z } from "zod";

/** A bug the practice assistant can slip into an answer, so reviewing AI output is tested. */
export interface PlantedBug {
  id: string;
  /** What's wrong, shown in the report afterward. */
  description: string;
  /** Regex source that matches the buggy code if it is still in the repo. */
  signature: string;
  /** For validation: turning the reference solution into the buggy one. */
  mutate: { path: string; from: string; to: string };
}

/** One canned answer from the scripted assistant (used when no API key is set). */
export interface AssistTopic {
  id: string;
  /** Prompt keywords (lowercase) that select this answer. */
  keywords: string[];
  /** Markdown answer. */
  reply: string;
  /** Variants of the answer with one planted bug each. */
  buggy?: { bug: string; reply: string }[];
}

export interface AssistedTask {
  id: string;
  title: string;
  /** One line for the task list. */
  summary: string;
  /** Which real rounds this resembles. */
  modeledOn: string;
  /** Markdown brief shown in the workspace. */
  brief: string;
  /** The repo as the candidate gets it. */
  files: Record<string, string>;
  /** The file opened first. */
  entry: string;
  /** Test files the candidate can see and run. */
  visibleTests: string[];
  /** Extra tests run only at the end, for grading. */
  hiddenTests: Record<string, string>;
  /** Files that solve the task, for validation (never sent to the browser). */
  reference: Record<string, string>;
  /**
   * The task's requirements, each as keywords; a prompt that hits most of
   * them asks for everything at once.
   */
  requirements: { label: string; keywords: string[] }[];
  bugs: PlantedBug[];
  topics: AssistTopic[];
}

export type AssistantKind = "claude" | "scripted";

/** Models the candidate can pick in the chat (spec: "a choice of models"). */
export const ASSISTANT_MODELS = [
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
] as const;
export const SCRIPTED_MODEL = { id: "practice", label: "Practice assistant (offline)" } as const;
export type AssistantModelId = (typeof ASSISTANT_MODELS)[number]["id"] | typeof SCRIPTED_MODEL.id;

const filesSchema = z.record(z.string().max(200), z.string().max(100_000));

/**
 * Timeline events. `t` is milliseconds since the session started.
 * - prompt / reply: the chat (written by the server; replies may carry a planted bug)
 * - snapshot: every file, taken while editing and at each test run
 * - paste: text pasted into the editor, and whether it came from an assistant reply
 * - run: a test run
 * - marker: start and end
 */
export const assistedEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("prompt"), t: z.number().int().nonnegative(), payload: z.object({ text: z.string().max(10_000), model: z.string() }) }),
  z.object({
    type: z.literal("reply"),
    t: z.number().int().nonnegative(),
    payload: z.object({
      text: z.string().max(50_000),
      model: z.string(),
      /** A bug planted in this answer: a task bug id (scripted) or a description (Claude). */
      planted: z.object({ id: z.string().optional(), description: z.string() }).optional(),
    }),
  }),
  z.object({ type: z.literal("snapshot"), t: z.number().int().nonnegative(), payload: z.object({ files: filesSchema }) }),
  z.object({
    type: z.literal("paste"),
    t: z.number().int().nonnegative(),
    payload: z.object({ path: z.string().max(200), chars: z.number().int().nonnegative(), fromAssistant: z.boolean() }),
  }),
  z.object({
    type: z.literal("run"),
    t: z.number().int().nonnegative(),
    payload: z.object({ passed: z.number().int().nonnegative(), total: z.number().int().nonnegative(), failing: z.array(z.string().max(300)).max(100) }),
  }),
  z.object({ type: z.literal("marker"), t: z.number().int().nonnegative(), payload: z.object({ what: z.enum(["start", "end"]) }) }),
]);
export type AssistedEvent = z.infer<typeof assistedEventSchema>;

/** Events the browser may send; prompts and replies are recorded by the server. */
export const clientEventSchema = assistedEventSchema.refine((e) => e.type === "snapshot" || e.type === "paste" || e.type === "run", "Not a client event");

export const filesInputSchema = filesSchema;
