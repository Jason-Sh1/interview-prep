import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  TypeConvert,
  type Card,
  type Grade,
} from "ts-fsrs";

// Spaced repetition for solved problems (spec 4.2), scheduled by FSRS.
// Reviews are day-scale, so short-term learning steps are off.

const scheduler = fsrs(
  generatorParameters({ request_retention: 0.9, enable_fuzz: true, enable_short_term: false, maximum_interval: 180 }),
);

export type Confidence = 1 | 2 | 3 | 4;

export const CONFIDENCE_LABELS: Record<Confidence, { label: string; help: string }> = {
  1: { label: "Again", help: "I couldn't have done it without help" },
  2: { label: "Hard", help: "Got there, but it was a struggle" },
  3: { label: "Good", help: "Solid, with some thinking" },
  4: { label: "Easy", help: "I knew it right away" },
};

/**
 * FSRS grade from the attempt. Self-rated confidence is the base grade; an
 * unsolved attempt is always Again, and hints cap the grade so using one
 * shortens the next interval (spec "Retrieval before reveal").
 */
export function gradeFor(opts: {
  solved: boolean;
  confidence: Confidence | null;
  hintsUsed: number;
  fastTrack: boolean;
}): Grade {
  if (!opts.solved) return Rating.Again;
  let g: number = opts.confidence ?? Rating.Good;
  if (opts.hintsUsed >= 2) g = Math.min(g, Rating.Hard);
  else if (opts.hintsUsed === 1) g = Math.min(g, Rating.Good);
  if (opts.fastTrack && g >= Rating.Good) g = Rating.Easy;
  return g as Grade;
}

export function newCard(now: Date): Card {
  return createEmptyCard(now);
}

export function reviewCard(card: Card, grade: Grade, now: Date): Card {
  return scheduler.next(card, now, grade).card;
}

/** Cards are stored as JSON; dates come back as strings. */
export function cardFromJson(json: Record<string, unknown>): Card {
  return TypeConvert.card(json as unknown as Card);
}

export function cardToJson(card: Card): Record<string, unknown> {
  return JSON.parse(JSON.stringify(card));
}

/** Chance of recalling the solution today, 0–1. */
export function retrievability(card: Card, now: Date): number {
  return scheduler.get_retrievability(card, now, false);
}
