// Rule-based grading for system design rounds. Scores the common interviewer
// rubric from the transcript and the whiteboard; Claude refines the wording and
// judgement when a key is set (see rounds/claude.ts), keeping these checks.
import {
  candidateTurns,
  clampScore,
  focusFrom,
  groupsMentioned,
  mentionsGroup,
  roundBarShift,
  roundHireSignal,
  scoreFromFraction,
  strengthsFrom,
  talkMetrics,
  weighted,
} from "../rounds/analyze";
import type { GradeContext } from "../rounds/kind";
import type { RoundCheck, RoundMoment, RoundReport, RoundScore } from "../rounds/types";
import { boardText, summarizeScene, type DesignArtifact } from "./scene";
import { isQuestion } from "./scripted";
import { DESIGN_TOPIC_BY_ID } from "./topics";

export const DESIGN_RUBRIC = ["requirements", "estimation", "architecture", "depth", "scale", "tradeoffs", "communication"] as const;
export type DesignRubricKey = (typeof DESIGN_RUBRIC)[number];

export const DESIGN_INFO: Record<DesignRubricKey, { label: string; help: string }> = {
  requirements: { label: "Requirements and scope", help: "Clarified functional and non-functional requirements before designing, and scoped the problem." },
  estimation: { label: "Estimation", help: "Put rough numbers on traffic and storage and used them to drive decisions." },
  architecture: { label: "High-level design", help: "A coherent set of components with a clear request flow, drawn so it can be discussed." },
  depth: { label: "Deep dives", help: "Went beyond boxes on the hardest parts: algorithms, data layout, consistency." },
  scale: { label: "Scalability and reliability", help: "Caching, partitioning, replication, and what happens when things fail." },
  tradeoffs: { label: "Trade-offs", help: "Named alternatives and explained why one fits these requirements better." },
  communication: { label: "Communication", help: "Drove the conversation, structured the answer, checked in with the interviewer." },
};

export const DESIGN_WEIGHTS: Record<DesignRubricKey, number> = {
  requirements: 1,
  estimation: 0.6,
  architecture: 1.5,
  depth: 1.4,
  scale: 1,
  tradeoffs: 1,
  communication: 1,
};

const DRILLS: Record<DesignRubricKey, { title: string; drill: string }> = {
  requirements: {
    title: "Spend the first five minutes on requirements",
    drill: "For your next design, write two lists before drawing anything: what's in scope (3-5 features) and the non-functional targets (scale, latency, availability, consistency).",
  },
  estimation: {
    title: "Do the napkin math out loud",
    drill: "Practice converting daily volume to per-second rates and yearly storage: 1 million a day is about 12 per second; multiply by peak factor and record size.",
  },
  architecture: {
    title: "Draw the request path first",
    drill: "Start every design with client, load balancer, service, data store, then trace one read and one write through the boxes before adding anything else.",
  },
  depth: {
    title: "Go one level deeper",
    drill: "Pick the hardest component of a design you've done and explain its internals for five minutes: the algorithm, the data layout, and how it fails.",
  },
  scale: {
    title: "Ask 'what breaks at 10x?'",
    drill: "For each box in your diagram, say how it scales (replicas, shards, cache) and what the user sees if it goes down.",
  },
  tradeoffs: {
    title: "Name the alternative every time",
    drill: "Each time you pick a technology or approach, say one alternative and the reason you didn't choose it: 'X instead of Y because...'.",
  },
  communication: {
    title: "Drive the round",
    drill: "Narrate a plan at the start ('requirements, estimates, API, high-level, then deep dives') and check in with the interviewer at each transition.",
  },
};

const NON_FUNCTIONAL = [["latency", "milliseconds", "fast"], ["availability", "available", "uptime"], ["consistency", "consistent", "eventual"], ["durability", "durable", "lose data"], ["scale", "qps", "throughput", "per second"]];
const SCALE_WORDS = [["cache", "caching", "redis", "memcached", "cdn"], ["shard", "sharding", "partition", "partitioning", "consistent hashing"], ["replica", "replication", "replicas", "read replica"], ["load balancer", "load balancing", "horizontal", "scale out", "stateless"], ["fail", "failure", "failover", "outage", "down"], ["queue", "async", "asynchronous", "backpressure"], ["monitor", "monitoring", "alert", "alerts", "metrics"]];
const TRADEOFF_RE = /\b(trade[- ]?offs?|instead of|rather than|versus|vs\.?|pros and cons|downside|the cost is|on the other hand|alternatively|at the expense of|in exchange)\b/gi;
const API_RE = /\b(api|endpoint|endpoints|rest|rpc|grpc|get \/|post \/|put \/|delete \/)\b/i;
const DATA_RE = /\b(schema|table|tables|entity|entities|data model|columns?|primary key|partition key|index)\b/i;
const SUMMARY_RE = /\b(to summari[sz]e|in summary|summary|recap|overall|to sum up|so in short)\b/i;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function gradeDesign(ctx: GradeContext<DesignArtifact>): RoundReport {
  const topic = DESIGN_TOPIC_BY_ID.get(ctx.topicId)!;
  const turns = ctx.transcript;
  const mine = candidateTurns(turns);
  const said = mine.map((t) => t.text).join(" \n");
  const board = summarizeScene(ctx.artifact.elements);
  const everything = `${said}\n${boardText(ctx.artifact)}`;
  const talk = talkMetrics(turns);
  // The first quarter of the planned round, so ending early doesn't shrink it.
  const firstQuarter = mine.filter((t) => t.t <= Math.max(ctx.durationMs, ctx.config.minutes * 60_000) * 0.25);
  const earlyQuestions = firstQuarter.filter((t) => isQuestion(t.text)).length;
  const nf = groupsMentioned(everything, NON_FUNCTIONAL).length;

  // Components: on the board, only spoken, or missing.
  const components = topic.components.map((c) => {
    const onBoard = board.components.some((label) => mentionsGroup(label, c.keywords)) || mentionsGroup(board.freeText.join(" "), c.keywords);
    const spoken = mentionsGroup(said, c.keywords);
    return { name: c.name, core: c.core, status: onBoard ? "board" : spoken ? "spoken" : "missing", probe: c.probe } as const;
  });
  const core = components.filter((c) => c.core);
  const coreCovered = core.filter((c) => c.status !== "missing").length / Math.max(1, core.length);
  const coreOnBoard = core.filter((c) => c.status === "board").length / Math.max(1, core.length);

  const dives = topic.deepDives.map((d) => {
    const hit = groupsMentioned(everything, d.keywords).length;
    return { id: d.id, title: d.title, coverage: Math.round((hit / d.keywords.length) * 100) / 100, strong: d.strong };
  });
  const bestDives = [...dives].sort((a, b) => b.coverage - a.coverage);
  const depthFrac = bestDives.length ? (bestDives[0].coverage + (bestDives[1]?.coverage ?? 0)) / 2 : 0;
  const scaleHits = groupsMentioned(everything, SCALE_WORDS).length;
  const tradeoffs = (said.match(TRADEOFF_RE) ?? []).length + (said.match(/\bbecause\b/gi) ?? []).length * 0.3;
  const numbers = mine.filter((t) => /\d/.test(t.text) || /\b(thousand|million|billion|per second|qps|tb|gb)\b/i.test(t.text)).length;

  const rubric: Record<DesignRubricKey, RoundScore> = {
    requirements: {
      score: clampScore(1 + Math.min(2, earlyQuestions * 0.7) + (nf >= 2 ? 1 : nf ? 0.5 : 0)),
      evidence: `${earlyQuestions} clarifying question${earlyQuestions === 1 ? "" : "s"} in the first quarter; ${nf ? `covered ${nf} non-functional area${nf === 1 ? "" : "s"} (scale, latency, availability...)` : "no non-functional requirements discussed"}.`,
    },
    estimation: {
      score: numbers >= 3 ? 4 : numbers === 2 ? 3 : numbers === 1 ? 2 : 1,
      evidence: numbers ? `Put numbers on the problem in ${numbers} answer${numbers === 1 ? "" : "s"}.` : "No traffic or storage estimates.",
    },
    architecture: {
      score: clampScore(scoreFromFraction(coreCovered, [0.3, 0.6, 0.85]) - (board.components.length < 3 ? 1 : 0) + (coreOnBoard >= 0.75 && board.connections.length >= 3 ? 0.5 : 0)),
      evidence: `${core.filter((c) => c.status !== "missing").length} of ${core.length} core components covered (${core.filter((c) => c.status === "board").length} on the whiteboard); ${plural(board.components.length, "labelled box", "labelled boxes")} and ${plural(board.connections.length, "arrow")} drawn.`,
    },
    depth: {
      score: scoreFromFraction(depthFrac, [0.2, 0.4, 0.65]),
      evidence: bestDives.length ? `Deepest on "${bestDives[0].title}" (${Math.round(bestDives[0].coverage * 100)}% of the key points)${bestDives[1] ? `, then "${bestDives[1].title}" (${Math.round(bestDives[1].coverage * 100)}%)` : ""}.` : "No deep dives.",
    },
    scale: {
      score: scaleHits >= 5 ? 4 : scaleHits >= 3 ? 3 : scaleHits >= 1 ? 2 : 1,
      evidence: `Touched ${scaleHits} of ${SCALE_WORDS.length} scaling and reliability themes (caching, partitioning, replication, load balancing, failure, queues, monitoring).`,
    },
    tradeoffs: {
      score: tradeoffs >= 5 ? 4 : tradeoffs >= 3 ? 3 : tradeoffs >= 1 ? 2 : 1,
      evidence: tradeoffs >= 1 ? `Explained choices against alternatives about ${Math.round(tradeoffs)} time${Math.round(tradeoffs) === 1 ? "" : "s"}.` : "Didn't compare alternatives or say why one choice beat another.",
    },
    communication: {
      score: clampScore(
        (talk.share >= 0.5 ? 3 : talk.share >= 0.35 ? 2 : 1) + (talk.fillersPer100 > 6 ? -1 : 0) + (talk.wordsPerTurn >= 25 ? 1 : 0) + (mine.length < 4 ? -1 : 0),
      ),
      evidence: `You did ${Math.round(talk.share * 100)}% of the talking, about ${talk.wordsPerTurn} words per answer${talk.fillersPer100 > 4 ? `, ${talk.fillersPer100} filler words per 100` : ""}.`,
    },
  };
  if (!mine.length) for (const k of DESIGN_RUBRIC) rubric[k] = { score: 1, evidence: "Nothing was said in this round." };

  const overall = weighted(rubric, DESIGN_WEIGHTS);
  const shift = roundBarShift(ctx.config.company, ctx.config.level) + (topic.level === "senior" ? -0.1 : 0);
  const cap = board.components.length < 2 && coreCovered < 0.5 ? "no" : undefined;
  const signal = roundHireSignal(overall, shift, cap);

  const checks: RoundCheck[] = [
    { label: "Asked clarifying questions before designing", ok: earlyQuestions >= 2, detail: `${earlyQuestions} in the first quarter` },
    { label: "Covered non-functional requirements", ok: nf >= 2 },
    { label: "Estimated traffic or storage", ok: numbers >= 1 },
    { label: "Defined an API", ok: API_RE.test(said) || API_RE.test(ctx.artifact.notes) },
    { label: "Described a data model or storage choice", ok: DATA_RE.test(everything) },
    { label: "Drew the design on the whiteboard", ok: board.components.length >= 4 && board.connections.length >= 2, detail: `${plural(board.components.length, "box", "boxes")}, ${plural(board.connections.length, "arrow")}` },
    { label: "Discussed failures", ok: mentionsGroup(said, SCALE_WORDS[4]) },
    { label: "Named trade-offs explicitly", ok: (said.match(TRADEOFF_RE) ?? []).length >= 2 },
    { label: "Summarized at the end", ok: mine.slice(-3).some((t) => SUMMARY_RE.test(t.text) || t.text.split(/\s+/).length > 60) },
  ];

  const moments: RoundMoment[] = [];
  const firstQ = mine.find((t) => isQuestion(t.text));
  if (firstQ) moments.push({ t: firstQ.t, tone: "good", text: "First clarifying question." });
  const firstNum = mine.find((t) => /\d/.test(t.text));
  if (firstNum) moments.push({ t: firstNum.t, tone: "good", text: "First estimate." });
  for (const t of turns) {
    if (t.speaker !== "interviewer") continue;
    const d = topic.deepDives.find((x) => t.text.includes(x.question.slice(20, 60)));
    if (d) moments.push({ t: t.t, tone: "info", text: `Deep dive: ${d.title}.` });
    const c = topic.components.find((x) => t.text === x.probe);
    if (c) moments.push({ t: t.t, tone: "warn", text: `Interviewer had to ask about ${c.name.toLowerCase()}.` });
  }
  moments.sort((a, b) => a.t - b.t);

  const reasons = [
    coreCovered >= 0.85 ? "Covered every core component of a workable design." : `Missed core pieces: ${core.filter((c) => c.status === "missing").map((c) => c.name.toLowerCase()).join(", ") || "none"}.`,
    rubric.depth.score >= 3 ? "Showed real depth in at least one deep dive." : "Stayed at the level of boxes; deep dives were shallow.",
    rubric.requirements.score >= 3 ? "Scoped the problem before designing." : "Jumped into the design without pinning down requirements.",
  ];
  const worst = [...DESIGN_RUBRIC].sort((a, b) => rubric[a].score - rubric[b].score || DESIGN_WEIGHTS[b] - DESIGN_WEIGHTS[a])[0];
  const best = [...DESIGN_RUBRIC].sort((a, b) => rubric[b].score - rubric[a].score || DESIGN_WEIGHTS[b] - DESIGN_WEIGHTS[a])[0];

  return {
    generator: "heuristic",
    summary: !mine.length
      ? "The round ended before you said anything, so there's nothing to grade yet."
      : rubric[best].score <= 2
        ? `There wasn't enough in this round to show a design yet. Start with ${DESIGN_INFO[worst].label.toLowerCase()}, and use the whole time next round.`
        : rubric[worst].score >= 4
          ? "Every part of the rubric was strong."
          : `Strongest: ${DESIGN_INFO[best].label.toLowerCase()}. Biggest gap: ${DESIGN_INFO[worst].label.toLowerCase()}.`,
    rubric,
    overall,
    hire: { signal, reasons },
    strengths: strengthsFrom(rubric, DESIGN_INFO),
    focus: focusFrom(rubric, DESIGN_WEIGHTS, DRILLS),
    checks,
    moments,
    extra: { components, dives, board: { components: board.components.length, connections: board.connections.length } },
  };
}

export function designGraderBrief(topicId: string): string {
  const t = DESIGN_TOPIC_BY_ID.get(topicId)!;
  return `Prompt: ${t.prompt}
In scope: ${t.functional.join("; ")}
Out of scope: ${t.outOfScope.join("; ")}
Non-functional: ${t.nonFunctional.join("; ")}
Reasonable estimates: ${t.estimates.join(" ")}
Components a solid design includes: ${t.components.map((c) => `${c.name}${c.core ? " (core)" : ""}`).join(", ")}
Deep dives and strong answers:
${t.deepDives.map((d) => `- ${d.title}: ${d.strong}`).join("\n")}
Trade-offs worth discussing: ${t.tradeoffs.join("; ")}
Typical level: ${t.level === "any" ? "any level" : t.level}.`;
}
