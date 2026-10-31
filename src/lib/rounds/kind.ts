// What each conversation round kind (system design, behavioral, code
// walkthrough) plugs into the shared round engine in ./index.ts. Pure: no
// database or network, so the scripted interviewers and graders are unit tested.
import type { z } from "zod";
import type { RoundConfig, RoundKind, RoundReport, Turn, TurnInput } from "./types";

export interface RoundTopic {
  id: string;
  title: string;
  /** One or two sentences for the picker. */
  summary: string;
}

export interface ScriptContext<A> {
  topicId: string;
  config: RoundConfig;
  companyName: string | null;
  /** The conversation so far, including the candidate's latest turn. */
  transcript: Turn[];
  artifact: A;
  input: TurnInput;
  elapsedMs: number;
  remainingMs: number;
  /** The scripted interviewer's saved state; a fresh round starts with {}. */
  state: Record<string, unknown>;
}

export interface ScriptReply {
  /** What the interviewer says, or ROUND_SILENT. */
  text: string;
  state: Record<string, unknown>;
}

export interface GradeContext<A> {
  topicId: string;
  config: RoundConfig;
  companyName: string | null;
  transcript: Turn[];
  artifact: A;
  /** From Start to the end, in milliseconds. */
  durationMs: number;
}

export interface RoundKindDef<A = Record<string, unknown>> {
  kind: RoundKind;
  topics: RoundTopic[];
  rubric: readonly string[];
  rubricInfo: Record<string, { label: string; help: string }>;
  weights: Record<string, number>;
  /** Validates an artifact coming from the browser. */
  artifactSchema: z.ZodType<A>;
  /** The artifact a new round starts with. */
  initialArtifact(topicId: string): A;
  /** The artifact as plain text, for the Claude interviewer and grader. */
  describeArtifact(topicId: string, artifact: A): string;
  /** The Claude interviewer's system prompt (stable for the whole round, so it caches). */
  systemPrompt(topicId: string, config: RoundConfig, company: { name: string; style: string } | null): string;
  /** The no-key interviewer: one reply per turn from a script with keyword checks. */
  scripted(ctx: ScriptContext<A>): ScriptReply;
  /** The rule-based report; always built, and the base Claude's grading refines. */
  grade(ctx: GradeContext<A>): RoundReport;
  /** Reference material for the Claude grader (what a strong answer covers). */
  graderBrief(topicId: string): string;
}
