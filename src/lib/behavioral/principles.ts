// Company principles and values that behavioral rounds probe, each mapped to
// the competencies a story needs to show it. Company ids match
// engine/companies.ts. Summaries are short paraphrases for practice, not the
// companies' official wording. Safe to import from the browser.
import type { CompetencyId } from "./competencies";

export interface Principle {
  id: string;
  name: string;
  /** What the interviewer is listening for, in a sentence. */
  summary: string;
  competencies: CompetencyId[];
}

export interface CompanyPrinciples {
  company: string;
  /** What the company calls them ("Leadership Principles", "values"). */
  label: string;
  principles: Principle[];
}

const p = (id: string, name: string, summary: string, competencies: CompetencyId[]): Principle => ({ id, name, summary, competencies });

export const COMPANY_PRINCIPLES: Record<string, CompanyPrinciples> = {
  amazon: {
    company: "amazon",
    label: "Leadership Principles",
    principles: [
      p("customer-obsession", "Customer Obsession", "Start from the customer and work backwards; earn and keep their trust.", ["customer"]),
      p("ownership", "Ownership", "Act for the long term and beyond your own team; never say \"that's not my job\".", ["ownership"]),
      p("invent-simplify", "Invent and Simplify", "Look for new ideas everywhere and make things simpler, even if misunderstood for a while.", ["innovation"]),
      p("are-right-a-lot", "Are Right, A Lot", "Good judgement and instincts; seek out views that disconfirm your own.", ["ambiguity", "disagree-commit"]),
      p("learn-curious", "Learn and Be Curious", "Keep learning and explore new possibilities.", ["growth"]),
      p("hire-develop", "Hire and Develop the Best", "Raise the bar with every hire and coach people to grow.", ["leadership", "teamwork"]),
      p("highest-standards", "Insist on the Highest Standards", "Keep raising the bar; fix defects so they stay fixed.", ["quality"]),
      p("think-big", "Think Big", "Set a bold direction that inspires results and look around corners.", ["innovation", "leadership"]),
      p("bias-for-action", "Bias for Action", "Speed matters; many decisions are reversible and need no extensive study.", ["ambiguity", "impact"]),
      p("frugality", "Frugality", "Do more with less; constraints breed resourcefulness.", ["prioritization", "innovation"]),
      p("earn-trust", "Earn Trust", "Listen, speak candidly, treat others respectfully, and own your mistakes.", ["communication", "failure", "conflict"]),
      p("dive-deep", "Dive Deep", "Stay close to the details, audit often, be skeptical when metrics and anecdotes differ.", ["quality", "ownership"]),
      p("backbone", "Have Backbone; Disagree and Commit", "Challenge decisions you disagree with, then commit fully once decided.", ["disagree-commit", "conflict"]),
      p("deliver-results", "Deliver Results", "Focus on the key inputs and deliver them with quality and on time, despite setbacks.", ["impact", "prioritization"]),
      p("best-employer", "Strive to be Earth's Best Employer", "Make the work environment better: safer, more inclusive, more growth for people.", ["teamwork", "leadership"]),
      p("broad-responsibility", "Success and Scale Bring Broad Responsibility", "Think about the wider effects of your work on people and communities.", ["customer", "ownership"]),
    ],
  },
  google: {
    company: "google",
    label: "Googleyness and leadership",
    principles: [
      p("ambiguity", "Thriving in ambiguity", "Make progress when the problem is vague and the answer isn't known.", ["ambiguity"]),
      p("feedback", "Valuing feedback", "Seek feedback, take it well, and change because of it.", ["growth"]),
      p("status-quo", "Challenging the status quo", "Question how things are done and push for a better way.", ["innovation", "disagree-commit"]),
      p("user-first", "Putting the user first", "Decisions start from what's best for users.", ["customer"]),
      p("right-thing", "Doing the right thing", "Integrity and ethics, even when it costs you.", ["ownership", "communication"]),
      p("team", "Caring about the team", "Collaborative, humble, and helps others succeed.", ["teamwork"]),
      p("emergent-leadership", "Emergent leadership", "Steps up to lead when needed and steps back when someone else should.", ["leadership"]),
      p("conflict", "Navigating disagreement", "Resolves conflict constructively and keeps relationships intact.", ["conflict"]),
    ],
  },
  meta: {
    company: "meta",
    label: "values and behavioral signals",
    principles: [
      p("move-fast", "Move fast", "Ship quickly, learn, and iterate; urgency over perfection.", ["impact", "prioritization"]),
      p("long-term", "Focus on long-term impact", "Pick the problems that matter most and measure outcomes.", ["impact", "ownership"]),
      p("build-awesome", "Build awesome things", "Hold a high bar for what you ship.", ["quality", "innovation"]),
      p("be-direct", "Be direct and respect your colleagues", "Give and receive honest feedback; handle conflict head on.", ["conflict", "communication"]),
      p("ambiguity", "Embracing ambiguity", "Drive projects forward without a clear spec.", ["ambiguity"]),
      p("growth", "Growing continuously", "Seek out feedback and grow from mistakes.", ["growth", "failure"]),
      p("metamates", "Meta, Metamates, me", "Put the company and team ahead of personal credit.", ["teamwork", "leadership"]),
    ],
  },
  microsoft: {
    company: "microsoft",
    label: "culture and leadership principles",
    principles: [
      p("growth-mindset", "Growth mindset", "Learn-it-all over know-it-all: curiosity, feedback, learning from failure.", ["growth", "failure"]),
      p("customer-obsessed", "Customer obsessed", "Understand customers' needs deeply and solve for them.", ["customer"]),
      p("one-microsoft", "One Microsoft", "Collaborate across teams and boundaries.", ["teamwork", "leadership"]),
      p("inclusive", "Diverse and inclusive", "Seek out different perspectives and make everyone heard.", ["teamwork", "communication"]),
      p("create-clarity", "Create clarity", "Bring clarity to complex or ambiguous situations.", ["ambiguity", "communication"]),
      p("deliver-success", "Deliver success", "Find ways to make things happen and deliver results.", ["impact", "ownership"]),
    ],
  },
  apple: {
    company: "apple",
    label: "commonly reported values",
    principles: [
      p("craft", "Attention to detail", "Care about craft and the small things users notice.", ["quality"]),
      p("dri", "Directly responsible", "Each piece of work has one owner who sees it through.", ["ownership"]),
      p("collaboration", "Cross-functional collaboration", "Work closely with design, hardware and other teams.", ["teamwork", "communication"]),
      p("user-privacy", "The user comes first", "Protect users' experience and privacy above convenience.", ["customer"]),
      p("simplicity", "Simplicity", "Remove complexity until only what matters is left.", ["innovation", "prioritization"]),
      p("passion", "Passion and drive", "Push hard on hard problems and deliver.", ["impact", "growth"]),
    ],
  },
  bloomberg: {
    company: "bloomberg",
    label: "values",
    principles: [
      p("customer", "Customer focus", "Clients depend on the terminal; their needs come first.", ["customer"]),
      p("ownership", "Ownership", "Take responsibility for systems and outcomes end to end.", ["ownership"]),
      p("collaboration", "Collaboration", "Work across teams, share knowledge, help others.", ["teamwork"]),
      p("curiosity", "Curiosity and learning", "Dig into new domains and technologies.", ["growth", "ambiguity"]),
      p("integrity", "Integrity", "Honest about mistakes and trade-offs.", ["failure", "communication"]),
      p("delivery", "Getting it done", "Deliver reliable software on time.", ["impact", "quality"]),
    ],
  },
  uber: {
    company: "uber",
    label: "values",
    principles: [
      p("customer-obsessed", "We are customer obsessed", "Riders, drivers, couriers and merchants come first.", ["customer"]),
      p("owners", "We act like owners", "Solve problems as if the company were yours.", ["ownership"]),
      p("persevere", "We persevere", "Keep going through setbacks and learn from them.", ["failure", "impact"]),
      p("ideas-over-hierarchy", "We value ideas over hierarchy", "The best idea wins, wherever it comes from; say what you think.", ["disagree-commit", "conflict"]),
      p("bold-bets", "We make big bold bets", "Take smart risks on big ideas.", ["innovation", "ambiguity"]),
      p("celebrate-differences", "We celebrate differences", "Build diverse teams and include every voice.", ["teamwork"]),
      p("right-thing", "We do the right thing", "Act with integrity.", ["communication", "ownership"]),
    ],
  },
  stripe: {
    company: "stripe",
    label: "operating principles",
    principles: [
      p("users-first", "Users first", "Work backwards from what users need.", ["customer"]),
      p("urgency", "Move with urgency and focus", "Prioritize ruthlessly and ship.", ["prioritization", "impact"]),
      p("craft", "Be meticulous in your craft", "Care about details and quality.", ["quality"]),
      p("seek-feedback", "Seek feedback", "Look for criticism and act on it.", ["growth"]),
      p("optimize-globally", "Optimize globally", "Do what's best for Stripe, not just your team.", ["teamwork", "ownership"]),
      p("rigor", "Think rigorously", "Reason carefully and admit when you're wrong.", ["ambiguity", "disagree-commit", "failure"]),
      p("curious", "Stay curious", "Learn about the domain and keep growing.", ["growth"]),
    ],
  },
  startup: {
    company: "startup",
    label: "what startups look for",
    principles: [
      p("bias-for-action", "Bias for action", "Ship quickly and learn from real use.", ["impact", "ambiguity"]),
      p("many-hats", "Ownership across the stack", "Do whatever the company needs, not just your role.", ["ownership"]),
      p("ambiguity", "Comfort with ambiguity", "Work with little process and changing priorities.", ["ambiguity", "prioritization"]),
      p("customer", "Close to customers", "Talk to users and build what they need.", ["customer"]),
      p("scrappy", "Scrappiness", "Do a lot with little; find the simplest thing that works.", ["innovation", "prioritization"]),
      p("learn-fast", "Learning fast", "Pick up new tools and domains quickly.", ["growth"]),
    ],
  },
};

export const principlesFor = (company: string | null | undefined): CompanyPrinciples | null => (company ? (COMPANY_PRINCIPLES[company] ?? null) : null);

/** Principles a set of competencies evidences. */
export function principlesShown(company: string | null | undefined, competencies: readonly string[]): Principle[] {
  const cp = principlesFor(company);
  if (!cp) return [];
  const have = new Set(competencies);
  return cp.principles.filter((x) => x.competencies.some((c) => have.has(c)));
}
