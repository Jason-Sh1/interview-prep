import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { PROBLEMS } from "../problems";
import { PATTERNS } from "../problems/patterns";
import { AI_POLICIES, cleanEmphasis, verifiedSources, type ProfileData, type Source } from "./profiles";
import { FREQUENCIES, cleanQuestions, type QuestionReport } from "./questions";

// The research step of spec 4.6: Claude searches the web for recent reports on
// a company's coding interviews, then a second call turns its notes into a
// structured profile. Two calls because citations and structured output don't
// mix in one response, and because it lets us check every source the second
// call names against the URLs the searches actually returned.

export const RESEARCH_MODEL = process.env.RESEARCH_MODEL || "claude-opus-5-5";
const MAX_CONTINUATIONS = 4;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const RESEARCH_SYSTEM = `You research software engineering interview processes for a prep platform. Candidates plan weeks of practice around what you find, so accuracy matters more than coverage.

Search for reports from the last 12 months: candidate write-ups (LeetCode Discuss, Glassdoor, Blind, Reddit, personal blogs), company careers and interview-prep pages, and news on interview format changes (especially AI-assisted or AI-allowed rounds). Prefer recent, first-hand and official sources; say when evidence is thin or conflicting. Don't repeat the current profile back unless a source confirms it.

Finish with notes covering, with the source URL for each claim:
1. The current coding loop: rounds, formats, lengths, by level where it differs.
2. AI tool policy in coding rounds.
3. Which algorithm patterns come up most and least, with any frequency data.
4. Specific problems candidates report being asked (public problem names, with LeetCode links where they exist) and how often each comes up.
5. Anything new in the last few months a candidate should know.`;

const PARSE_SYSTEM = `You turn research notes into a structured company interview profile for a prep platform's planner. Only use what the notes support. Where the notes give no evidence on a pattern, keep the current weight. Cite only URLs that appear in the notes.`;

const parseSchema = z.object({
  style: z.string().describe("One sentence on how the coding rounds feel, for a candidate"),
  loop: z.string().describe("The current coding loop in one or two sentences: rounds, formats, lengths. Empty if the notes don't say"),
  ai: z.enum(AI_POLICIES).describe("Whether candidates may use AI tools in coding rounds"),
  emphasis: z
    .array(z.object({ pattern: z.enum(PATTERNS.map((p) => p.id) as [string, ...string[]]), weight: z.number().describe("0 to 1: how much the coding rounds lean on this pattern") }))
    .describe("A weight for every pattern with evidence; omit patterns with none"),
  notes: z.array(z.string()).describe("Up to three short, dated notes a candidate should know that aren't in the current profile, e.g. 'Since March 2026 one round allows an AI assistant.' Empty if nothing is new"),
  sources: z.array(z.object({ url: z.string(), title: z.string(), published: z.string().optional().describe("YYYY-MM or YYYY-MM-DD if known") })).describe("The sources the profile rests on, most important first, at most eight"),
  questions: z
    .array(
      z.object({
        title: z.string().describe("The public problem's name, e.g. 'Merge Intervals'"),
        url: z.string().optional().describe("Link to the public problem (e.g. its LeetCode page), if known"),
        frequency: z.enum(FREQUENCIES).describe("high: many recent reports; medium: a few; low: one or two"),
        lastSeen: z.string().optional().describe("YYYY-MM or YYYY-MM-DD of the latest report, if known"),
        sourceUrl: z.string().describe("The URL of the source that reports it, from the pages the searches returned"),
      }),
    )
    .describe("Problems candidates report being asked recently, most frequent first, at most twenty. Empty if the notes name none"),
  confidence: z.enum(["high", "medium", "low"]).describe("How well the sources support this profile"),
});

export interface ResearchResult {
  data: ProfileData;
  sources: Source[];
  questions: QuestionReport[];
  confidence: "high" | "medium" | "low";
}

function describe(current: ProfileData): string {
  const weights = PATTERNS.map((p) => `${p.id}: ${current.emphasis[p.id] ?? 0.3}`).join(", ");
  return `Style: ${current.style}
Loop: ${current.loop || "(not recorded)"}
AI policy: ${current.ai}
Pattern weights (0 to 1; 0.3 means no particular emphasis): ${weights}
Notes: ${current.notes.join(" ") || "(none)"}`;
}

/** Researches one company and returns a cleaned profile with verified sources. */
export async function researchCompany(companyId: string, current: ProfileData, now = new Date()): Promise<ResearchResult> {
  const month = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `It is ${month}. Research the current software engineer coding interview at ${current.name} (company id "${companyId}").\n\nThe platform's current profile:\n${describe(current)}`,
    },
  ];

  const seen = new Map<string, { title: string; published?: string }>();
  let notes = "";
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const res = await getClient().beta.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: RESEARCH_SYSTEM,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
      messages,
    });
    for (const block of res.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.type === "web_search_result") seen.set(r.url, { title: r.title, ...(r.page_age ? { published: r.page_age } : {}) });
        }
      } else if (block.type === "text") {
        notes += block.text;
        for (const c of block.citations ?? []) {
          if (c.type === "web_search_result_location" && !seen.has(c.url)) seen.set(c.url, { title: c.title ?? c.url });
        }
      }
    }
    if (res.stop_reason === "refusal") throw new Error("The research model declined");
    if (res.stop_reason !== "pause_turn") break;
    // A long search loop pauses; send the turn back and the server resumes it.
    messages.push({ role: "assistant", content: res.content });
  }
  if (!notes.trim()) throw new Error("The research step returned no notes");

  const sourceList = [...seen].map(([url, v]) => `- ${v.title} (${url})${v.published ? `, ${v.published}` : ""}`).join("\n");
  const parsed = await getClient().beta.messages.parse({
    model: RESEARCH_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(parseSchema) },
    system: PARSE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `# Current profile for ${current.name}\n${describe(current)}\n\n# Research notes\n${notes}\n\n# Pages the searches returned\n${sourceList || "(none)"}`,
      },
    ],
  });
  const p = parsed.parsed_output;
  if (!p) throw new Error("The research model returned no profile");

  // Patterns without evidence keep their current weight.
  const emphasis = cleanEmphasis({
    ...(current.emphasis as Record<string, number>),
    ...Object.fromEntries(p.emphasis.map((e) => [e.pattern, e.weight])),
  });
  const sources = verifiedSources(p.sources, seen).slice(0, 8);
  if (!sources.length) throw new Error("No source in the profile matched a search result");
  const verify = (url: string) => verifiedSources([{ url, title: "" }], seen)[0] ?? null;
  return {
    questions: cleanQuestions(p.questions, verify, PROBLEMS),
    data: { name: current.name, style: p.style || current.style, loop: p.loop, ai: p.ai, emphasis, notes: p.notes.slice(0, 3) },
    sources,
    confidence: p.confidence,
  };
}
