// Which stories cover which competencies and company principles, and where the
// gaps are. Pure, so the story bank page and tests share it.
import { COMPETENCIES, suggestCompetencies, type CompetencyId } from "./competencies";
import { principlesFor, type Principle } from "./principles";
import { storyText, type StoryFields } from "./star";

export interface CoverageStory extends StoryFields {
  id: number;
}

export interface CoverageRow {
  id: string;
  label: string;
  /** Story ids that cover it. */
  stories: number[];
}

export interface Coverage {
  competencies: CoverageRow[];
  /** The company's principles, or empty for no company. */
  principles: (CoverageRow & { principle: Principle })[];
  /** Labels with no story, principles first. */
  gaps: string[];
  /** Rows covered by only one story; a second story helps when an interviewer asks twice. */
  thin: string[];
}

/** A story's competencies: its tags, or a keyword guess when it has none. */
export const storyCompetencies = (s: StoryFields): string[] => (s.competencies.length ? s.competencies : suggestCompetencies(storyText(s), 2));

export function coverageMatrix(stories: CoverageStory[], company: string | null): Coverage {
  const comps = new Map(stories.map((s) => [s.id, new Set(storyCompetencies(s))]));
  const covering = (ids: readonly CompetencyId[] | readonly string[]) => stories.filter((s) => ids.some((c) => comps.get(s.id)!.has(c))).map((s) => s.id);
  const competencies = COMPETENCIES.map((c) => ({ id: c.id, label: c.label, stories: covering([c.id]) }));
  const principles = (principlesFor(company)?.principles ?? []).map((p) => ({ id: p.id, label: p.name, principle: p, stories: covering(p.competencies) }));
  const rows = principles.length ? principles : competencies;
  return {
    competencies,
    principles,
    gaps: rows.filter((r) => !r.stories.length).map((r) => r.label),
    thin: rows.filter((r) => r.stories.length === 1).map((r) => r.label),
  };
}
