// Runs the company research job once (spec 4.6), the same as the weekly cron.
// New versions land in the review queue at /research.
// Usage: npm run research [company-id ...]
import { runResearch } from "../src/lib/research/index";

async function main() {
  const ids = process.argv.slice(2);
  const run = await runResearch("cli", ids);
  if (!run) {
    console.error("A research run is already going.");
    process.exit(1);
  }
  if (run.status === "skipped") {
    console.error(run.error);
    process.exit(1);
  }
  for (const r of run.results) console.log(`${r.companyId.padEnd(12)} ${r.result}${r.error ? `: ${r.error}` : ""}`);
  console.log(`Run ${run.id}: ${run.status}. Review new versions at /research.`);
  process.exit(run.status === "failed" ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
