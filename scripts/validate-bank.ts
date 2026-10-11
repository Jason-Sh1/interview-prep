// Checks every problem in the bank: shape, unique slugs, and that the JavaScript
// reference solution passes all of its tests through the real test driver.
// Usage: npx tsx scripts/validate-bank.ts [pattern-or-slug ...]
import { PATTERN_BY_ID } from "../src/lib/problems/patterns";
import { PROBLEMS } from "../src/lib/problems/index";
import { runLocally } from "../src/lib/runner/local";

const filters = process.argv.slice(2);
const slugs = new Set<string>();
let failures = 0;

for (const p of PROBLEMS) {
  if (filters.length && !filters.includes(p.pattern) && !filters.includes(p.slug)) continue;
  const problems: string[] = [];
  if (slugs.has(p.slug)) problems.push("duplicate slug");
  slugs.add(p.slug);
  if (!PATTERN_BY_ID[p.pattern]) problems.push(`unknown pattern ${p.pattern}`);
  if (!p.tests.some((t) => t.sample)) problems.push("no sample tests");
  if (p.tests.length < 5) problems.push(`only ${p.tests.length} tests (need 5+)`);
  if (p.hints.length !== 3 || p.hints.some((h) => !h.trim())) problems.push("needs 3 hints");
  if (!p.complexity.time.startsWith("O(")) problems.push("complexity.time should look like O(...)");
  const out = runLocally(p.signature, "javascript", p.reference, p.tests);
  if (out.verdict !== "accepted") {
    problems.push(`reference ${out.verdict}${out.message ? `: ${out.message}` : ""}`);
    for (const r of out.results.filter((r) => !r.passed)) {
      problems.push(
        `  test ${r.index}: input=${JSON.stringify(r.input)} expected=${JSON.stringify(r.expected)} actual=${JSON.stringify(r.actual)}${r.error ? ` error=${r.error}` : ""}`,
      );
    }
  }
  if (problems.length) {
    failures++;
    console.log(`✗ ${p.slug}\n  ${problems.join("\n  ")}`);
  } else {
    console.log(`✓ ${p.slug}`);
  }
}

console.log(`\n${failures ? `${failures} problem(s) failed` : "All problems valid"}`);
process.exit(failures ? 1 : 0);
