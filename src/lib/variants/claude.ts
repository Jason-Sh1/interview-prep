import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Problem } from "../problems/types";
import { COMPARE_MODES, VALUE_TYPES, type VariantDraft } from "./shape";

// Drafts a review variant with Claude. The draft is only used after its
// reference solution passes its own tests (see ./index.ts).

export const VARIANT_MODEL = process.env.VARIANT_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const SYSTEM = `You write review variants for a coding interview prep platform. The candidate solved the original problem before; the variant should test whether they understand the idea, not whether they remember their code.

Make one real change: tighter or different constraints that force a different trade-off, a follow-up twist an interviewer would ask ("what if the input is a stream?", "return all answers, not one", "now values can be negative"), or the same idea in a new setting. It should stay in the same pattern and roughly the same difficulty, be solvable in 15 to 30 minutes, and be original wording (never copy a published problem's text).

Rules for the parts:
- The function takes and returns only the listed value types. ListNode and TreeNode are passed as arrays (a list as its values; a tree in level order with null for missing children).
- reference: plain JavaScript, a function declaration with the given name, no imports, no I/O, correct and efficient.
- tests: 8 to 14 cases, two or three marked as samples, covering edge cases with short labels ("empty input", "all negative"). Each input is a JSON array of the arguments; expected is the JSON value the reference returns. Keep inputs small enough to read.
- compare: "exact" unless the order of the answer doesn't matter ("unordered" for a list in any order, "unordered-nested" when inner lists are unordered too) or it's a floating-point result ("float").
- statement: Markdown, addressed to the candidate, with the parameter names in backticks.
- hints: a nudge, the approach, then pseudocode.`;

const draftSchema = z.object({
  title: z.string().describe("A short new title"),
  twist: z.string().describe("One sentence, to the candidate, on what's different from the original"),
  statement: z.string(),
  constraints: z.array(z.string()).describe("Two to five input constraints, e.g. '1 <= nums.length <= 10^5'"),
  hints: z.array(z.string()).describe("Exactly three: nudge, approach, pseudocode"),
  complexity: z.object({ time: z.string().describe("e.g. O(n log n)"), space: z.string() }),
  functionName: z.string().describe("camelCase"),
  params: z.array(z.object({ name: z.string().describe("camelCase"), type: z.enum(VALUE_TYPES) })),
  returns: z.enum(VALUE_TYPES),
  compare: z.enum(COMPARE_MODES),
  reference: z.string(),
  tests: z.array(
    z.object({
      input: z.string().describe("JSON array of the arguments"),
      expected: z.string().describe("JSON of the return value"),
      label: z.string().optional(),
      sample: z.boolean(),
    }),
  ),
});

export async function draftVariant(base: Problem, avoid: string[]): Promise<VariantDraft> {
  const sig = base.signature.kind === "function" ? base.signature : null;
  if (!sig) throw new Error("Variants are only made for function problems");
  const res = await getClient().beta.messages.parse({
    model: VARIANT_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(draftSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `# Original: ${base.title} (${base.difficulty}, pattern ${base.pattern})
${base.statement}

Constraints: ${base.constraints.join("; ")}
Signature: ${sig.name}(${sig.params.map((p) => `${p.name}: ${p.type}`).join(", ")}) -> ${sig.returns}
Optimal: ${base.complexity.time} time, ${base.complexity.space} space.

Reference solution:
\`\`\`js
${base.reference}
\`\`\`
${avoid.length ? `\nVariants that already exist (make a different change):\n${avoid.map((t) => `- ${t}`).join("\n")}\n` : ""}
Write one variant.`,
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("The variant model declined");
  if (!res.parsed_output) throw new Error("The variant model returned nothing");
  return res.parsed_output;
}
