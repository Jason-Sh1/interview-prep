// The no-key system design interviewer: walks the usual arc (requirements,
// estimates, API and data model, high-level design, deep dives, scale and
// failure, wrap-up), answers clarifying questions from the topic's facts, and
// reads the whiteboard to probe missing components. Pure and deterministic.
import { groupsMentioned, mentionsGroup, pick } from "../rounds/analyze";
import type { ScriptContext, ScriptReply } from "../rounds/kind";
import { ROUND_SILENT, type RoundConfig } from "../rounds/types";
import { boardText, summarizeScene, type DesignArtifact } from "./scene";
import { DESIGN_TOPIC_BY_ID, type DesignTopic } from "./topics";

export const DESIGN_PHASES = ["requirements", "estimation", "api", "high-level", "deep-dive", "scale", "wrap", "closed"] as const;
export type DesignPhase = (typeof DESIGN_PHASES)[number];

/** Share of the round by which each phase should be done. */
const PHASE_END: Partial<Record<DesignPhase, number>> = {
  requirements: 0.15,
  estimation: 0.22,
  api: 0.32,
  "high-level": 0.5,
  "deep-dive": 0.82,
  scale: 0.92,
};

export interface DesignScriptState {
  phase: DesignPhase;
  phaseTurns: number;
  nonFunctional: boolean;
  boardNudged: boolean;
  flowAsked: boolean;
  askedComponents: string[];
  dives: string[];
  diveFollowedUp: boolean;
  turns: number;
}

export const INITIAL_DESIGN_STATE: DesignScriptState = {
  phase: "requirements",
  phaseTurns: 0,
  nonFunctional: false,
  boardNudged: false,
  flowAsked: false,
  askedComponents: [],
  dives: [],
  diveFollowedUp: false,
  turns: 0,
};

const ACKS: Record<RoundConfig["persona"], string[]> = {
  friendly: ["Nice.", "Good, that makes sense.", "Great.", "Okay, I like that."],
  neutral: ["Okay.", "Got it.", "Alright.", "Understood."],
  terse: ["Mm.", "Okay.", "Fine.", "Noted."],
};

const NON_FUNCTIONAL = [["latency", "fast", "milliseconds", "ms"], ["availability", "available", "uptime", "nines"], ["scale", "scalable", "qps", "throughput", "users"], ["consistency", "consistent", "eventual"], ["durability", "durable", "lose data", "never lose"], ["reliable", "reliability"]];
const FAILURE = [["fail", "failure", "failover", "down", "outage", "crash", "dies"], ["replica", "replication", "replicas", "redundant", "redundancy"], ["region", "regions", "data center", "datacenter", "multi az", "availability zone"], ["retry", "retries", "backup", "backups"]];
const API_WORDS = [["api", "endpoint", "endpoints", "rest", "rpc", "grpc", "graphql"], ["get", "post", "put", "delete", "patch"], ["request", "response", "returns", "parameters", "params"]];
const DATA_WORDS = [["table", "tables", "schema", "entity", "entities", "model", "column", "columns", "record", "records"], ["database", "db", "store", "storage", "sql", "nosql", "key value"]];
const MOVE_ON = /\b(move on|moving on|next step|let'?s (design|draw|start|go)|high[- ]level|i'?m ready|ready to)\b/i;

const hasNumbers = (s: string) => /\d/.test(s) || /\b(thousand|million|billion|trillion|hundred|qps|rps|tb|gb|pb|kb|mb|per second)\b/i.test(s);
export const isQuestion = (s: string) => /\?\s*$/.test(s.trim()) || /^(what|how|can|could|should|do|does|is|are|will|would|which|when|where|who|why|any)\b/i.test(s.trim());

/** The topic fact that best answers a question, if any. */
export function answerFact(topic: DesignTopic, question: string): string | null {
  let best: { n: number; answer: string } | null = null;
  for (const f of topic.facts) {
    const n = f.keywords.filter((k) => mentionsGroup(question, [k])).length;
    if (n && (!best || n > best.n)) best = { n, answer: f.answer };
  }
  return best?.answer ?? null;
}

function phaseIntro(phase: DesignPhase, topic: DesignTopic, s: DesignScriptState, ctx: ScriptContext<DesignArtifact>): string {
  switch (phase) {
    case "estimation":
      return "Let's do some quick back-of-the-envelope estimates. Roughly how many requests per second, and how much storage over a few years?";
    case "api":
      return "What would the main API look like? Just the key calls and what they take and return.";
    case "high-level":
      return "Now sketch the high-level design on the whiteboard, and walk me through how a request flows through it.";
    case "deep-dive": {
      const dive = nextDive(topic, s, ctx);
      if (!dive) return phaseIntro("scale", topic, s, ctx);
      s.dives.push(dive.id);
      s.diveFollowedUp = false;
      return dive.question;
    }
    case "scale":
      return "What breaks first if traffic grows ten times? And how does the system cope when a server, or a whole data center, goes down?";
    case "wrap":
      return "We're almost out of time. Give me a quick summary of your design and the main trade-offs you made. And do you have any questions for me?";
    default:
      return "";
  }
}

/** The deep dive not yet asked that the candidate has covered least so far. */
function nextDive(topic: DesignTopic, s: DesignScriptState, ctx: ScriptContext<DesignArtifact>) {
  const said = ctx.transcript.filter((t) => t.speaker === "candidate").map((t) => t.text).join(" ");
  return topic.deepDives
    .filter((d) => !s.dives.includes(d.id))
    .map((d) => ({ d, cov: groupsMentioned(said, d.keywords).length / d.keywords.length }))
    .sort((a, b) => a.cov - b.cov)[0]?.d;
}

function advance(s: DesignScriptState, to?: DesignPhase) {
  const i = DESIGN_PHASES.indexOf(s.phase);
  s.phase = to ?? DESIGN_PHASES[Math.min(i + 1, DESIGN_PHASES.length - 1)];
  s.phaseTurns = 0;
}

export function designScripted(ctx: ScriptContext<DesignArtifact>): ScriptReply {
  const topic = DESIGN_TOPIC_BY_ID.get(ctx.topicId);
  if (!topic) return { text: ROUND_SILENT, state: ctx.state };
  const s: DesignScriptState = { ...INITIAL_DESIGN_STATE, ...(ctx.state as Partial<DesignScriptState>) };
  s.askedComponents = [...s.askedComponents];
  s.dives = [...s.dives];
  s.turns++;
  const ack = () => pick(ACKS[ctx.config.persona], s.turns);
  const done = (text: string): ScriptReply => ({ text, state: s as unknown as Record<string, unknown> });
  const input = ctx.input;
  const total = ctx.elapsedMs + ctx.remainingMs;
  const frac = total ? ctx.elapsedMs / total : 0;

  if (input.kind === "start") {
    const hello = ctx.config.persona === "terse" ? "Hi." : ctx.config.persona === "friendly" ? "Hi, thanks for joining! This is a system design round." : "Hi. This is a system design round.";
    return done(`${hello} ${topic.prompt} Feel free to use the whiteboard as we go.`);
  }
  if (s.phase === "closed") return done(input.kind === "say" ? "We're out of time. Press End to get your written report." : ROUND_SILENT);
  if (input.kind === "wrap") {
    if (s.phase === "wrap") return done(ROUND_SILENT);
    advance(s, "wrap");
    return done(phaseIntro("wrap", topic, s, ctx));
  }
  if (input.kind === "silence") {
    const board = summarizeScene(ctx.artifact.elements);
    if (s.phase === "high-level" && board.components.length < 2) return done("Talk me through what you're thinking. It helps to get the main boxes onto the whiteboard.");
    return done(pick(["Talk me through what you're thinking.", "What's on your mind right now?", "Where are you headed with this?"], s.turns));
  }

  const text = input.text;
  s.phaseTurns++;

  // A clarifying question gets an answer from the brief, in any phase.
  if (isQuestion(text) && s.phase !== "wrap") {
    const fact = answerFact(topic, text);
    if (fact) return done(s.phase === "requirements" ? `${fact} What else would you like to know?` : fact);
    if (s.phase === "requirements" || s.phase === "estimation")
      return done("Good question. Make a reasonable assumption, say it out loud, and we'll go with it.");
    return done("Your call. Say what you'd assume and why, and keep going.");
  }

  // Running behind: move along to the phase the clock says we should be in.
  const behind = PHASE_END[s.phase] !== undefined && frac > PHASE_END[s.phase]! && s.phase !== "deep-dive";
  if (behind) {
    let to: DesignPhase = s.phase;
    while (PHASE_END[to] !== undefined && frac > PHASE_END[to]!) to = DESIGN_PHASES[DESIGN_PHASES.indexOf(to) + 1];
    advance(s, to);
    return done(`${ack()} In the interest of time, let's keep moving. ${phaseIntro(to, topic, s, ctx)}`);
  }

  switch (s.phase) {
    case "requirements": {
      if (groupsMentioned(text, NON_FUNCTIONAL).length) s.nonFunctional = true;
      if (s.phaseTurns >= 3 || MOVE_ON.test(text)) {
        if (!s.nonFunctional && s.phaseTurns < 4 && !MOVE_ON.test(text)) return done("Before we move on: what about non-functional requirements, like scale, latency and availability?");
        advance(s);
        return done(`${ack()} ${phaseIntro("estimation", topic, s, ctx)}`);
      }
      if (s.phaseTurns === 2 && !s.nonFunctional) return done(`${ack()} What about non-functional requirements, like scale, latency and availability?`);
      return done(`${ack()} Anything else you'd want to pin down before designing?`);
    }
    case "estimation": {
      if (!hasNumbers(text) && s.phaseTurns < 2) return done("Can you put rough numbers on it? Requests per second, and storage over a few years.");
      advance(s);
      return done(`${ack()} ${phaseIntro("api", topic, s, ctx)}`);
    }
    case "api": {
      if (s.phaseTurns === 1) {
        if (!groupsMentioned(text, API_WORDS).length) return done("Be a bit more concrete: what are the main endpoints, and what does each take and return?");
        return done(`${ack()} And the data model: what are the main entities, and what kind of store would you put them in?`);
      }
      if (s.phaseTurns === 2 && !groupsMentioned(text, DATA_WORDS).length) return done("Which database, or kind of database, would you use for that, and why?");
      advance(s);
      return done(`${ack()} ${phaseIntro("high-level", topic, s, ctx)}`);
    }
    case "high-level": {
      const board = summarizeScene(ctx.artifact.elements);
      if (board.components.length < 3 && !s.boardNudged) {
        s.boardNudged = true;
        return done("I can't see much on the whiteboard yet. Draw the main components as labelled boxes with arrows, so we can both point at them.");
      }
      const said = `${boardText(ctx.artifact)} ${ctx.transcript.filter((t) => t.speaker === "candidate").map((t) => t.text).join(" ")}`;
      const missing = topic.components.find((c) => c.core && !s.askedComponents.includes(c.name) && !mentionsGroup(said, c.keywords));
      if (missing && s.askedComponents.length < 2) {
        s.askedComponents.push(missing.name);
        return done(missing.probe);
      }
      if (!s.flowAsked) {
        s.flowAsked = true;
        return done(`${ack()} Walk me through one request end to end, from the client through each box.`);
      }
      advance(s);
      return done(`${ack()} Let's go deeper. ${phaseIntro("deep-dive", topic, s, ctx)}`);
    }
    case "deep-dive": {
      const dive = topic.deepDives.find((d) => d.id === s.dives.at(-1));
      if (dive) {
        const recent = ctx.transcript.filter((t) => t.speaker === "candidate").slice(-2).map((t) => t.text).join(" ");
        const hit = groupsMentioned(recent, dive.keywords);
        if (hit.length / dive.keywords.length < 0.4 && !s.diveFollowedUp) {
          s.diveFollowedUp = true;
          const gap = dive.keywords.find((_, i) => !hit.includes(i));
          return done(gap ? `How would ${gap[0]} come into this?` : "Can you be more specific about how that works?");
        }
      }
      const maxDives = frac < 0.65 ? 3 : 2;
      if (s.dives.length < maxDives && nextDive(topic, s, ctx) && frac < PHASE_END["deep-dive"]!) return done(`${ack()} ${phaseIntro("deep-dive", topic, s, ctx)}`);
      advance(s);
      return done(`${ack()} ${phaseIntro("scale", topic, s, ctx)}`);
    }
    case "scale": {
      if (s.phaseTurns === 1 && !groupsMentioned(text, FAILURE).length) return done("And if a machine, or a whole region, goes down? What does the user notice?");
      advance(s);
      return done(`${ack()} ${phaseIntro("wrap", topic, s, ctx)}`);
    }
    case "wrap": {
      advance(s, "closed");
      const asked = /\?/.test(text) || /\b(question|ask you|curious)\b/i.test(text);
      return done(
        `${asked ? "Good question. In a real loop I'd answer it about the team; here, the report will cover how this went. " : ""}Thanks, that's time. Press End and you'll get a written report on the round.`,
      );
    }
  }
  return done(ack());
}
