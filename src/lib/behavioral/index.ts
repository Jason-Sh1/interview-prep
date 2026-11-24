// Behavioral rounds (spec 4.5, phase 4): questions from a topic set, asked
// against the candidate's story bank, with STAR checks, follow-up probing and
// the target company's principles. Plugs into the shared round engine (src/lib/rounds).
import type { RoundKindDef } from "../rounds/kind";
import type { RoundConfig } from "../rounds/types";
import { behavioralArtifactSchema, describeBehavioral, type BehavioralArtifact } from "./artifact";
import { competencyLabel } from "./competencies";
import { BEHAVIORAL_INFO, BEHAVIORAL_RUBRIC, BEHAVIORAL_WEIGHTS, behavioralGraderBrief, gradeBehavioral } from "./grade";
import { principlesFor } from "./principles";
import { BEHAVIORAL_TOPIC_BY_ID, BEHAVIORAL_TOPICS, pickQuestions, QUESTION_BY_ID } from "./questions";
import { behavioralScripted } from "./scripted";

const PERSONA_STYLE: Record<RoundConfig["persona"], string> = {
  friendly: "Warm and encouraging; you make the candidate comfortable but still probe for specifics.",
  neutral: "Professional and even; you listen closely and probe.",
  terse: "Brief and businesslike, like a busy hiring manager. Few words.",
};

function systemPrompt(topicId: string, config: RoundConfig, company: { name: string; style: string } | null): string {
  const topic = BEHAVIORAL_TOPIC_BY_ID.get(topicId)!;
  const cp = principlesFor(config.company ?? topic.company);
  const ids = pickQuestions(topicId, config.minutes, config.company);
  const qs = ids.map((id) => QUESTION_BY_ID.get(id)!);
  return `You are an experienced interviewer running a live ${config.minutes}-minute behavioral interview over voice${company ? ` for ${company.name}` : ""}. Every message includes the candidate's story bank (titles and short STAR summaries they prepared) and the planned questions.

Your words are spoken aloud by text-to-speech, so reply in one to three short spoken sentences, with no Markdown, lists or symbols.

How to run the round:
- Open briefly, then ask the planned questions in order, one at a time, using the wording given.
- After each answer, probe one or two gaps before moving on, like a real interviewer: what the candidate personally did (if they said "we" a lot), the outcome and any numbers, the situation if it was unclear, what they would do differently, or a detail that doesn't add up. If they mentioned a story from their bank, you may ask about details in its summary.
- Don't accept hypotheticals ("I would...") as answers: ask for a real example.
- Keep to the clock: about ${Math.round((config.minutes - 4) / Math.max(1, qs.length))} minutes per question. If time is short, skip the remaining questions.
- With about three minutes left, ask "Do you have any questions for me?", answer briefly and generically, then thank them and close.
- Never coach the candidate or give scores or a hire decision during the round.
- When a message is an event rather than speech, reply only if an interviewer would actually say something. Otherwise reply with exactly <silent>.
- The candidate's speech comes from speech recognition; read it charitably.

Persona: ${PERSONA_STYLE[config.persona]}
Level: ${config.level}. ${config.level === "new-grad" ? "School, internship and personal projects are fine examples." : config.level === "senior" || config.level === "staff" ? "Expect scope beyond one team: leading, influencing, setting direction." : ""}
${company ? `Company style: ${company.name}.` : ""}${cp ? `\nThe ${cp.label} you're assessing:\n${cp.principles.map((p) => `- ${p.name}: ${p.summary}`).join("\n")}` : ""}

Question set: ${topic.title}.
Planned questions and what each tests:
${qs.map((q, i) => `${i + 1}. ${q.text} (tests: ${q.competencies.map(competencyLabel).join(", ")}; good follow-ups: ${q.probes.join(" / ")})`).join("\n")}`;
}

export const behavioralKind: RoundKindDef<BehavioralArtifact> = {
  kind: "behavioral",
  topics: BEHAVIORAL_TOPICS,
  rubric: BEHAVIORAL_RUBRIC,
  rubricInfo: BEHAVIORAL_INFO,
  weights: BEHAVIORAL_WEIGHTS,
  artifactSchema: behavioralArtifactSchema,
  initialArtifact: (topicId) => ({ questionIds: pickQuestions(topicId, 30, null), stories: [], notes: "" }),
  describeArtifact: (_topicId, a) => describeBehavioral(a),
  systemPrompt,
  scripted: behavioralScripted,
  grade: gradeBehavioral,
  graderBrief: behavioralGraderBrief,
};
