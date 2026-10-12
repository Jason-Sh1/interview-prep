// Shared types for live mock interviews (spec 4.3). Used by the browser, the
// API routes, the interviewer and the voice agent worker.
import { z } from "zod";

export const PERSONAS = ["friendly", "neutral", "terse"] as const;
export type Persona = (typeof PERSONAS)[number];

export const LENGTHS = [30, 45, 60] as const;

export const mockConfigSchema = z.object({
  persona: z.enum(PERSONAS),
  minutes: z.union([z.literal(30), z.literal(45), z.literal(60)]),
  hintsAllowed: z.boolean(),
  /** Company id from engine/companies.ts, or null for a generic interview. */
  company: z.string().nullable(),
});
export type MockConfig = z.infer<typeof mockConfigSchema>;

export type VoiceMode = "livekit" | "browser";
export type InterviewerKind = "claude" | "scripted";

/** One Monaco change: replace `length` characters at `offset` with `text`. */
export const editOpSchema = z.object({
  offset: z.number().int().nonnegative(),
  length: z.number().int().nonnegative(),
  text: z.string().max(100_000),
});
export type EditOp = z.infer<typeof editOpSchema>;

const speakerSchema = z.enum(["candidate", "interviewer"]);
export type Speaker = z.infer<typeof speakerSchema>;

/**
 * Timeline events. `t` is milliseconds since the session started.
 * - edit: one editor change event (its ops refer to the code before the change)
 * - snapshot: the full code, taken periodically and at every run, so replay
 *   can resync and readers don't have to apply every edit
 * - run: a test run and its verdict
 * - transcript: a finished utterance from either speaker
 * - marker: lifecycle moments (start, language switch, end)
 */
export const eventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("edit"),
    t: z.number().int().nonnegative(),
    payload: z.object({ ops: z.array(editOpSchema).max(500) }),
  }),
  z.object({
    type: z.literal("snapshot"),
    t: z.number().int().nonnegative(),
    payload: z.object({ code: z.string().max(100_000), language: z.enum(["python", "javascript"]) }),
  }),
  z.object({
    type: z.literal("run"),
    t: z.number().int().nonnegative(),
    payload: z.object({
      scope: z.enum(["sample", "all"]),
      verdict: z.string(),
      passed: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      failingLabels: z.array(z.string()).max(50),
      message: z.string().max(2000).optional(),
    }),
  }),
  z.object({
    type: z.literal("transcript"),
    t: z.number().int().nonnegative(),
    payload: z.object({
      speaker: speakerSchema,
      text: z.string().max(5000),
      /** How it was captured: browser speech recognition, typed, LiveKit STT, or the interviewer. */
      source: z.enum(["browser-stt", "typed", "livekit-stt", "interviewer"]),
      /** When the utterance started, if known (end is `t`). */
      startT: z.number().int().nonnegative().optional(),
      /** The interviewer was cut off (the candidate ran tests or spoke) before finishing. */
      interrupted: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal("marker"),
    t: z.number().int().nonnegative(),
    payload: z.object({ what: z.enum(["start", "end", "language", "barge-in"]), detail: z.string().max(200).optional() }),
  }),
]);
export type SessionEvent = z.infer<typeof eventSchema>;
export type RunPayload = Extract<SessionEvent, { type: "run" }>["payload"];
export type TranscriptPayload = Extract<SessionEvent, { type: "transcript" }>["payload"];

/**
 * What prompts an interviewer turn.
 * - start: open the interview
 * - utterance: the candidate finished saying something
 * - silence: the candidate has been quiet for a while
 * - run: the candidate ran tests (the interviewer may stay quiet)
 * - wrap: time is nearly up
 */
export const turnKindSchema = z.enum(["start", "utterance", "silence", "run", "wrap"]);
export type TurnKind = z.infer<typeof turnKindSchema>;

/** Returned by the interviewer when it chooses to say nothing. */
export const SILENT = "<silent>";
