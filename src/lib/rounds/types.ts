// Shared types for conversation rounds (spec 4.5, phase 4): system design,
// behavioral and code walkthrough. A round is a timed conversation with an AI
// interviewer around an artifact the candidate builds or brings (a whiteboard,
// stories, code). Safe to import from the browser.
import { z } from "zod";
import type { HireSignal } from "../feedback/analyze";
import { PERSONAS, type Persona } from "../interview/types";

export const ROUND_KINDS = ["design", "behavioral", "walkthrough"] as const;
export type RoundKind = (typeof ROUND_KINDS)[number];

export const ROUND_INFO: Record<RoundKind, { label: string; path: string; blurb: string }> = {
  design: {
    label: "System design",
    path: "/design",
    blurb: "Design a system on a whiteboard while the interviewer drives requirements, scale, deep dives and trade-offs.",
  },
  behavioral: {
    label: "Behavioral",
    path: "/behavioral",
    blurb: "Answer behavioral questions from your story bank, with STAR checks, follow-up probing and company principles.",
  },
  walkthrough: {
    label: "Code walkthrough",
    path: "/walkthrough",
    blurb: "Walk an interviewer through a take-home or your own project and defend the decisions you made.",
  },
};

export const ROUND_LENGTHS = [20, 30, 45, 60] as const;

export const roundConfigSchema = z.object({
  minutes: z.union([z.literal(20), z.literal(30), z.literal(45), z.literal(60)]),
  persona: z.enum(PERSONAS),
  /** Company id from engine/companies.ts, or null for a generic round. */
  company: z.string().max(40).nullable(),
  /** The user's level from their goals, for calibration. */
  level: z.string().max(20),
});
export type RoundConfig = z.infer<typeof roundConfigSchema> & { persona: Persona };

export type Speaker = "interviewer" | "candidate";

export interface Turn {
  speaker: Speaker;
  text: string;
  /** Milliseconds since Start. */
  t: number;
  /** "voice" or "typed" for the candidate; absent for the interviewer. */
  source?: string;
  /** The interviewer was cut off before finishing. */
  interrupted?: boolean;
}

/** What prompted an interviewer turn. */
export const turnInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("start") }),
  z.object({ kind: z.literal("say"), text: z.string().trim().min(1).max(5_000), source: z.enum(["voice", "typed"]) }),
  z.object({ kind: z.literal("silence") }),
  z.object({ kind: z.literal("wrap") }),
]);
export type TurnInput = z.infer<typeof turnInputSchema>;

export interface RoundScore {
  /** 1 to 4. */
  score: number;
  evidence: string;
}

export interface RoundFocus {
  /** A rubric key. */
  area: string;
  title: string;
  why: string;
  drill: string;
}

/** A pass/fail check the report lists (for example "Asked about scale"). */
export interface RoundCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface RoundMoment {
  t: number;
  tone: "good" | "warn" | "info";
  text: string;
}

export interface RoundReport {
  generator: "claude" | "heuristic";
  summary: string;
  rubric: Record<string, RoundScore>;
  overall: number;
  hire: { signal: HireSignal; reasons: string[] };
  strengths: string[];
  focus: RoundFocus[];
  checks: RoundCheck[];
  moments: RoundMoment[];
  /** Kind-specific extras for the report page (for example per-question STAR results). */
  extra?: Record<string, unknown>;
}

/** The silent reply: the interviewer says nothing this turn. */
export const ROUND_SILENT = "<silent>";
