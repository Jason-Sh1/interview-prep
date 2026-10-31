// The competencies behavioral interviewers probe for, each with the words that
// tend to show up in a story about it. Used to tag stories, check an answer's
// relevance and map stories to company principles. Safe to import from the browser.
import { groupsMentioned, type KeywordGroups } from "../rounds/analyze";

export const COMPETENCY_IDS = [
  "ownership",
  "conflict",
  "failure",
  "leadership",
  "ambiguity",
  "customer",
  "impact",
  "teamwork",
  "growth",
  "prioritization",
  "disagree-commit",
  "innovation",
  "quality",
  "communication",
] as const;
export type CompetencyId = (typeof COMPETENCY_IDS)[number];

export interface Competency {
  id: CompetencyId;
  label: string;
  /** What an interviewer wants to hear, in a sentence. */
  help: string;
  keywords: KeywordGroups;
}

export const COMPETENCIES: Competency[] = [
  {
    id: "ownership",
    label: "Ownership",
    help: "You took responsibility for something beyond your job description and saw it through.",
    keywords: [
      ["ownership", "owned", "took ownership", "took responsibility", "responsible for"],
      ["volunteered", "stepped up", "on my own", "nobody else", "no one else", "without being asked"],
      ["on call", "on-call", "incident", "outage", "postmortem", "post-mortem"],
      ["followed through", "saw it through", "end to end", "end-to-end"],
    ],
  },
  {
    id: "conflict",
    label: "Conflict",
    help: "You worked through a real disagreement with a peer, manager or partner and kept the relationship.",
    keywords: [
      ["conflict", "disagreed", "disagreement", "disagree", "pushed back", "push back", "pushback"],
      ["tension", "frustrated", "upset", "argument", "heated", "clash"],
      ["one on one", "one-on-one", "sat down with", "talked it through", "their perspective", "common ground"],
      ["difficult coworker", "difficult teammate", "difficult person", "difficult stakeholder"],
    ],
  },
  {
    id: "failure",
    label: "Failure and learning",
    help: "Something went wrong, you own your part, and you can say what you changed afterwards.",
    keywords: [
      ["failed", "failure", "mistake", "messed up", "broke", "went wrong", "missed the deadline", "bug in production"],
      ["learned", "lesson", "takeaway", "in hindsight", "looking back", "differently"],
      ["rollback", "rolled back", "postmortem", "post-mortem", "root cause"],
    ],
  },
  {
    id: "leadership",
    label: "Leadership and influence",
    help: "You got people to follow a direction without (or beyond) formal authority.",
    keywords: [
      ["led", "lead", "leading", "leadership", "drove", "spearheaded"],
      ["influence", "influenced", "convinced", "persuaded", "aligned", "buy-in", "buy in", "rallied"],
      ["mentored", "mentor", "mentoring", "coached", "onboarded", "taught"],
      ["without authority", "cross-team", "cross team", "cross-functional", "stakeholders"],
    ],
  },
  {
    id: "ambiguity",
    label: "Ambiguity",
    help: "You made progress when the goal, requirements or path were unclear.",
    keywords: [
      ["ambiguous", "ambiguity", "unclear", "vague", "uncertain", "uncertainty", "unknown", "no spec"],
      ["assumption", "assumptions", "prototype", "spike", "experiment", "figured out"],
      ["first time", "never done", "new to", "from scratch"],
    ],
  },
  {
    id: "customer",
    label: "Customer focus",
    help: "You started from what users or customers needed and let that drive the work.",
    keywords: [
      ["customer", "customers", "user", "users", "client", "clients"],
      ["feedback", "user research", "interviews", "support tickets", "complaints", "nps"],
      ["experience", "pain point", "pain points", "needs", "requested"],
    ],
  },
  {
    id: "impact",
    label: "Impact and delivery",
    help: "You shipped something that mattered, on time, and can measure the result.",
    keywords: [
      ["shipped", "launched", "delivered", "released", "rolled out", "deployed"],
      ["deadline", "on time", "ahead of schedule", "milestone"],
      ["reduced", "increased", "improved", "saved", "grew", "cut", "doubled", "halved"],
      ["revenue", "latency", "cost", "conversion", "retention", "throughput"],
    ],
  },
  {
    id: "teamwork",
    label: "Teamwork",
    help: "You made the people around you more effective and shared credit.",
    keywords: [
      ["team", "teammate", "teammates", "together", "collaborated", "collaboration", "pair programmed", "paired"],
      ["helped", "supported", "unblocked", "covered for"],
      ["group project", "hackathon", "club", "partner"],
    ],
  },
  {
    id: "growth",
    label: "Learning and growth",
    help: "You picked up something new quickly or sought feedback and acted on it.",
    keywords: [
      ["learned", "taught myself", "picked up", "ramped up", "read up", "studied", "course"],
      ["feedback", "criticism", "constructive", "review comments"],
      ["new language", "new technology", "new framework", "unfamiliar"],
    ],
  },
  {
    id: "prioritization",
    label: "Prioritization",
    help: "You chose what not to do when there was more work than time, and explained the trade-off.",
    keywords: [
      ["prioritize", "prioritized", "prioritization", "priorities", "trade-off", "tradeoff", "trade off"],
      ["deadline", "time pressure", "tight timeline", "competing", "too much"],
      ["cut scope", "descoped", "mvp", "deferred", "pushed back the", "said no"],
    ],
  },
  {
    id: "disagree-commit",
    label: "Disagree and commit",
    help: "You argued for your view, lost (or compromised), then committed fully to the decision.",
    keywords: [
      ["disagree and commit", "committed", "commit to", "went with their", "went with the decision", "backed the decision"],
      ["disagreed", "pushed back", "argued", "made my case", "data to back"],
      ["compromise", "compromised", "agreed to try", "trusted"],
    ],
  },
  {
    id: "innovation",
    label: "Invention and simplification",
    help: "You found a new or simpler way to do something and got it adopted.",
    keywords: [
      ["new approach", "idea", "invented", "created", "designed", "proposed", "came up with"],
      ["simplified", "simplify", "automated", "automate", "script", "tool", "tooling"],
      ["first", "novel", "creative", "hack"],
    ],
  },
  {
    id: "quality",
    label: "High standards",
    help: "You raised the bar on quality: tests, reviews, reliability, or refusing to ship something broken.",
    keywords: [
      ["quality", "standards", "bar", "high bar"],
      ["tests", "testing", "test coverage", "code review", "reviews", "refactor", "refactored"],
      ["reliability", "reliable", "bugs", "regressions", "monitoring", "alerts"],
    ],
  },
  {
    id: "communication",
    label: "Communication",
    help: "You explained something complex to the right audience or kept people informed when it mattered.",
    keywords: [
      ["explained", "presented", "presentation", "demo", "wrote a doc", "design doc", "documentation"],
      ["updated", "status update", "kept them informed", "communicated", "transparent"],
      ["non-technical", "non technical", "executives", "leadership team", "stakeholders"],
    ],
  },
];

export const COMPETENCY_BY_ID = new Map<string, Competency>(COMPETENCIES.map((c) => [c.id, c]));

export const competencyLabel = (id: string) => COMPETENCY_BY_ID.get(id)?.label ?? id;

/** The fraction of a competency's keyword groups the text touches, 0..1. */
export function competencyScore(text: string, id: CompetencyId): number {
  const c = COMPETENCY_BY_ID.get(id);
  if (!c) return 0;
  return groupsMentioned(text, c.keywords).length / c.keywords.length;
}

/** The competencies a story or answer most likely shows, strongest first. */
export function suggestCompetencies(text: string, max = 3): CompetencyId[] {
  return COMPETENCIES.map((c) => ({ id: c.id, n: groupsMentioned(text, c.keywords).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((x) => x.id);
}
