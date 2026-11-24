// The behavioral question bank and the question sets (topics) the round picker
// offers. Questions are original wordings of the common themes; each is tagged
// with the competencies it tests, the companies whose principles it fits, and
// follow-up probes an interviewer would use once the STAR basics are covered.
import type { RoundTopic } from "../rounds/kind";
import type { CompetencyId } from "./competencies";

export interface BehavioralQuestion {
  id: string;
  text: string;
  competencies: CompetencyId[];
  /** Company ids (engine/companies.ts) whose principles this question fits. */
  companies: string[];
  level: "any" | "new-grad" | "senior";
  /** Follow-ups once the answer covers situation, action and result. */
  probes: string[];
}

const q = (id: string, text: string, competencies: CompetencyId[], companies: string[], probes: string[], level: BehavioralQuestion["level"] = "any"): BehavioralQuestion => ({
  id,
  text,
  competencies,
  companies,
  level,
  probes,
});

export const BEHAVIORAL_QUESTIONS: BehavioralQuestion[] = [
  // Ownership and delivery
  q("own-beyond-role", "Tell me about a time you took on something that was clearly outside your job description because it needed doing.", ["ownership"], ["amazon", "uber", "startup", "apple"], [
    "Why did you pick it up instead of flagging it to someone else?",
    "What happened to it after you handed it off or moved on?",
  ]),
  q("own-incident", "Walk me through a production issue or outage you were involved in. What was your part in it?", ["ownership", "quality"], ["amazon", "bloomberg", "stripe", "uber"], [
    "How did you find the root cause?",
    "What did you change so it couldn't happen again?",
  ]),
  q("deliver-deadline", "Tell me about a project where you were at real risk of missing a deadline. What did you do?", ["impact", "prioritization"], ["amazon", "meta", "microsoft"], [
    "What did you cut, and how did you decide?",
    "Who did you tell, and when?",
  ]),
  q("deliver-setback", "Describe a time a project hit a serious setback partway through. How did you get it back on track?", ["impact", "ownership"], ["amazon", "uber", "microsoft"], [
    "Looking back, were there early signs you missed?",
    "How did the team feel during the setback, and what did you do about it?",
  ]),
  q("proudest", "What's the piece of work you're proudest of? Walk me through it.", ["impact", "ownership"], ["google", "meta", "apple", "startup"], [
    "What was the hardest technical decision in it?",
    "What would you build differently today?",
  ]),
  q("dive-deep", "Tell me about a time you had to dig into the details to find out what was really going on, when the surface explanation didn't add up.", ["quality", "ownership"], ["amazon", "stripe", "bloomberg"], [
    "What made you suspicious in the first place?",
    "How did you check your conclusion?",
  ]),

  // Conflict and disagreement
  q("conflict-peer", "Tell me about a time you had a disagreement with a teammate. How did you resolve it?", ["conflict", "communication"], ["google", "meta", "microsoft", "bloomberg"], [
    "How did you make sure you understood their side?",
    "How is your relationship with that person now?",
  ]),
  q("conflict-manager", "Describe a time you disagreed with your manager or a more senior person. What happened?", ["conflict", "disagree-commit"], ["amazon", "meta", "uber"], [
    "What data or argument did you bring?",
    "If they'd overruled you, what would you have done?",
  ]),
  q("disagree-commit", "Tell me about a decision you disagreed with but went along with anyway. How did you handle it?", ["disagree-commit"], ["amazon", "stripe", "uber"], [
    "Did you say you disagreed? How?",
    "How did it turn out, and did that change your view?",
  ]),
  q("difficult-person", "Tell me about working with someone who was difficult to work with.", ["conflict", "teamwork"], ["google", "microsoft", "apple", "bloomberg"], [
    "What do you think was driving their behavior?",
    "What did you learn about working with people like that?",
  ]),
  q("pushback-stakeholder", "Describe a time you had to say no to, or push back on, a request from a stakeholder or customer.", ["prioritization", "communication"], ["stripe", "meta", "startup"], [
    "How did they react?",
    "What did you offer them instead?",
  ]),
  q("direct-feedback", "Tell me about a time you gave someone difficult feedback.", ["communication", "conflict"], ["meta", "google", "microsoft"], [
    "How did you prepare for the conversation?",
    "What changed afterwards?",
  ]),

  // Failure and learning
  q("failure", "Tell me about a time you failed. What happened and what did you learn?", ["failure", "growth"], ["amazon", "google", "meta", "microsoft", "startup"], [
    "What was your part in it, specifically?",
    "Have you been in a similar situation since? What did you do differently?",
  ]),
  q("mistake-shipped", "Tell me about a mistake you made that affected other people, like a bug you shipped. How did you handle it?", ["failure", "ownership"], ["amazon", "stripe", "bloomberg"], [
    "How quickly did you tell people, and how?",
    "What did you put in place so it wouldn't repeat?",
  ]),
  q("criticism", "Tell me about a time you got critical feedback. What did you do with it?", ["growth"], ["google", "microsoft", "stripe", "meta"], [
    "Did you agree with it at first?",
    "How would the person who gave it describe you now?",
  ]),
  q("wrong-call", "Describe a time you were confident you were right and turned out to be wrong.", ["failure", "growth"], ["amazon", "stripe", "google"], [
    "When did you realize you were wrong?",
    "How do you check yourself now?",
  ]),

  // Leadership and influence
  q("influence-no-authority", "Tell me about a time you convinced people to do something when you had no authority over them.", ["leadership", "communication"], ["google", "amazon", "microsoft", "meta"], [
    "Who was hardest to convince, and what changed their mind?",
    "What would you have done if they'd said no?",
  ]),
  q("lead-project", "Tell me about a project you led from start to finish.", ["leadership", "impact"], ["amazon", "meta", "google"], [
    "How did you split the work and keep it on track?",
    "What would you do differently leading it again?",
  ], "senior"),
  q("mentor", "Tell me about a time you helped someone else grow, like mentoring or onboarding a teammate.", ["leadership", "teamwork"], ["amazon", "google", "microsoft"], [
    "How did you know it was working?",
    "What did you learn about teaching from it?",
  ]),
  q("set-direction", "Describe a time you set the technical direction for a team or a large piece of work.", ["leadership", "ambiguity"], ["amazon", "google", "meta", "stripe"], [
    "What alternatives did you consider, and why did you reject them?",
    "How did you get the team bought in?",
  ], "senior"),
  q("cross-team", "Tell me about a time you had to get several teams to work together toward one goal.", ["leadership", "teamwork"], ["microsoft", "apple", "amazon", "uber"], [
    "Where did the teams' goals conflict?",
    "How did you keep everyone informed?",
  ], "senior"),
  q("think-big", "Tell me about a time you proposed something much bigger or more ambitious than what was asked.", ["innovation", "leadership"], ["amazon", "uber", "meta"], [
    "How did you make the case for it?",
    "What part of it actually happened?",
  ], "senior"),

  // Ambiguity and judgement
  q("ambiguity", "Tell me about a time you had to make progress on something with very unclear requirements.", ["ambiguity"], ["google", "meta", "microsoft", "startup"], [
    "What assumptions did you make, and how did you check them?",
    "When did things become clear?",
  ]),
  q("decide-no-data", "Describe a time you had to make a decision quickly without all the information you wanted.", ["ambiguity", "impact"], ["amazon", "startup", "uber"], [
    "What would have changed your decision?",
    "Was the decision reversible? Did that matter?",
  ]),
  q("new-domain", "Tell me about a time you had to learn something completely new quickly to get the job done.", ["growth", "ambiguity"], ["amazon", "google", "bloomberg", "startup"], [
    "How did you decide what to learn first?",
    "How did you know when you knew enough?",
  ]),

  // Customer focus
  q("customer-need", "Tell me about a time you went out of your way to understand what a user or customer actually needed.", ["customer"], ["amazon", "stripe", "apple", "bloomberg"], [
    "How did what you learned change what you built?",
    "How did you measure whether it helped them?",
  ]),
  q("customer-tradeoff", "Describe a time you had to balance what a customer asked for against what was good for the product or the business.", ["customer", "prioritization"], ["amazon", "uber", "stripe"], [
    "Who did you involve in the decision?",
    "How did the customer take it?",
  ]),

  // Prioritization
  q("prioritize", "Tell me about a time you had more work than you could possibly do. How did you decide what to do?", ["prioritization"], ["meta", "stripe", "startup", "microsoft"], [
    "What did you drop, and what happened as a result?",
    "How did you communicate the trade-off?",
  ]),
  q("speed-vs-quality", "Tell me about a time you had to choose between shipping fast and doing it properly.", ["prioritization", "quality"], ["meta", "amazon", "stripe", "startup"], [
    "Did you go back and pay down the shortcut?",
    "Would you make the same call again?",
  ]),

  // High standards and innovation
  q("raise-bar", "Tell me about a time you raised the quality bar on your team, for example on testing, reviews or reliability.", ["quality"], ["amazon", "apple", "stripe", "bloomberg"], [
    "Did anyone push back on the extra effort?",
    "How did you know it made a difference?",
  ]),
  q("simplify", "Describe a time you found a much simpler way to do something your team was doing the hard way.", ["innovation"], ["amazon", "apple", "startup", "google"], [
    "How did you get people to adopt it?",
    "What did it save, roughly?",
  ]),
  q("automate", "Tell me about something you automated or a tool you built that helped other people.", ["innovation", "teamwork"], ["amazon", "startup", "bloomberg"], [
    "How many people used it, and did you hear back from them?",
    "What would you add if you had more time?",
  ]),

  // Teamwork and communication
  q("team-success", "Tell me about a time you helped your team succeed in a way that didn't show up in your own work.", ["teamwork"], ["google", "meta", "microsoft", "apple"], [
    "Did anyone notice? Did that matter to you?",
    "What did it cost your own work?",
  ]),
  q("explain-complex", "Tell me about a time you had to explain something technical to a non-technical audience.", ["communication"], ["microsoft", "bloomberg", "google"], [
    "How did you check they understood?",
    "What would you explain differently next time?",
  ]),
  q("underperformer", "Tell me about a time a teammate wasn't pulling their weight. What did you do?", ["teamwork", "conflict"], ["amazon", "meta", "google"], [
    "Did you talk to them directly first?",
    "What happened in the end?",
  ]),

  // New grad
  q("ng-hardest-project", "Tell me about the most technically challenging project you've worked on, at school, an internship or on your own.", ["impact", "growth"], ["google", "meta", "microsoft", "apple", "bloomberg"], [
    "What was the hardest bug or problem, and how did you get past it?",
    "What did you personally build, versus the rest of the group?",
  ], "new-grad"),
  q("ng-group-project", "Tell me about a group project where things didn't go smoothly.", ["teamwork", "conflict"], ["google", "microsoft", "bloomberg", "meta"], [
    "How was the work split, and was that fair?",
    "What would you change about how the group worked?",
  ], "new-grad"),
  q("ng-internship", "What did you work on in your internship or most recent job, and what came of it?", ["impact", "ownership"], ["meta", "amazon", "microsoft", "startup"], [
    "Is it still in use?",
    "What feedback did you get at the end?",
  ], "new-grad"),
  q("ng-why", "Why this company, and why this kind of role?", ["growth", "customer"], ["google", "meta", "amazon", "microsoft", "apple", "bloomberg", "uber", "stripe", "startup"], [
    "What would you want to work on first?",
    "What else are you considering?",
  ], "new-grad"),
  q("ng-self-taught", "Tell me about something you taught yourself outside of class.", ["growth"], ["google", "startup", "apple"], [
    "Why that, of all things?",
    "How did you know you'd learned it well?",
  ], "new-grad"),
];

export const QUESTION_BY_ID = new Map(BEHAVIORAL_QUESTIONS.map((x) => [x.id, x]));

export interface BehavioralTopic extends RoundTopic {
  /** The company whose principles this set targets, if any. */
  company: string | null;
  level: "any" | "new-grad" | "senior";
  /** Questions in the order asked; a round takes as many as fit the time. */
  questionIds: string[];
}

export const BEHAVIORAL_TOPICS: BehavioralTopic[] = [
  {
    id: "amazon-lp",
    title: "Amazon leadership principles",
    summary: "Ownership, customer obsession, disagree and commit, deliver results, dive deep. Expect a probe on every answer.",
    company: "amazon",
    level: "any",
    questionIds: ["own-beyond-role", "customer-need", "disagree-commit", "deliver-deadline", "mistake-shipped", "dive-deep", "simplify", "raise-bar", "think-big"],
  },
  {
    id: "general",
    title: "Google and general",
    summary: "The common mix: ambiguity, conflict, feedback, influence and the work you're proudest of.",
    company: null,
    level: "any",
    questionIds: ["proudest", "ambiguity", "conflict-peer", "criticism", "influence-no-authority", "failure", "team-success", "new-domain"],
  },
  {
    id: "conflict-failure",
    title: "Conflict and failure",
    summary: "The questions people least like: disagreements, difficult people, mistakes, and being wrong.",
    company: null,
    level: "any",
    questionIds: ["conflict-peer", "failure", "conflict-manager", "mistake-shipped", "difficult-person", "wrong-call", "direct-feedback", "underperformer"],
  },
  {
    id: "leadership-senior",
    title: "Leadership and impact (senior)",
    summary: "Leading projects, setting direction, influencing across teams, and growing others.",
    company: null,
    level: "senior",
    questionIds: ["lead-project", "set-direction", "cross-team", "conflict-manager", "mentor", "deliver-setback", "speed-vs-quality", "think-big"],
  },
  {
    id: "new-grad",
    title: "New grad: projects and teamwork",
    summary: "School, internship and personal projects: what you built, how you worked in a group, and what you learned.",
    company: null,
    level: "new-grad",
    questionIds: ["ng-hardest-project", "ng-group-project", "ng-internship", "failure", "ng-self-taught", "criticism", "ng-why"],
  },
  {
    id: "fast-moving",
    title: "Fast-moving teams (Meta, Stripe, startups)",
    summary: "Shipping under pressure, prioritization, pushing back, and direct feedback.",
    company: null,
    level: "any",
    questionIds: ["prioritize", "speed-vs-quality", "pushback-stakeholder", "decide-no-data", "direct-feedback", "own-incident", "automate", "customer-tradeoff"],
  },
];

export const BEHAVIORAL_TOPIC_BY_ID = new Map(BEHAVIORAL_TOPICS.map((t) => [t.id, t]));

export const BEHAVIORAL_LENGTHS = [20, 30, 45] as const;

/** How many main questions fit a round of this length, with follow-ups and time for your questions. */
export const questionCount = (minutes: number) => (minutes <= 20 ? 3 : minutes <= 30 ? 4 : 6);

/**
 * The questions for a round: the topic's set in order, with questions that fit
 * the chosen company's principles moved forward when the set isn't company-specific.
 */
export function pickQuestions(topicId: string, minutes: number, company: string | null): string[] {
  const topic = BEHAVIORAL_TOPIC_BY_ID.get(topicId);
  if (!topic) return [];
  let ids = topic.questionIds.filter((id) => QUESTION_BY_ID.has(id));
  if (company && !topic.company) {
    const fits = (id: string) => QUESTION_BY_ID.get(id)!.companies.includes(company);
    // Keep the opener; reorder the rest so company-fit questions come first.
    ids = [ids[0], ...ids.slice(1).filter(fits), ...ids.slice(1).filter((id) => !fits(id))];
  }
  return ids.slice(0, questionCount(minutes));
}
