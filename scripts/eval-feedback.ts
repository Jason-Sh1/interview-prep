// Feedback-quality eval: scores the feedback graders against the labeled
// scenarios in evals/feedback and writes results to evals/feedback/results.
//
//   npm run eval:feedback             heuristic grader, plus Claude replayed from
//                                     recordings if there's a full set (free)
//   npm run eval:feedback -- --record call Claude once per missing scenario and
//                                     save the responses (needs ANTHROPIC_API_KEY;
//                                     about $2 for all 24 on claude-opus-5-5)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FEEDBACK_MODEL } from "../src/lib/feedback/claude";
import {
  RESULTS_DIR,
  heuristicGrader,
  missingRecordings,
  recordLive,
  recordingsDir,
  replayGrader,
  runEval,
  type EvalResult,
} from "../evals/feedback/harness";
import { SCENARIOS } from "../evals/feedback/scenarios";

const pct = (x: number | null) => (x === null ? "  n/a" : `${(x * 100).toFixed(1).padStart(5)}%`);

function print(r: EvalResult) {
  const s = r.summary;
  console.log(`\n${r.grader}${r.model ? ` (${r.model})` : ""}: ${s.sessions} sessions, labels ${r.labelsHash} (${r.labelStatus})`);
  console.log(`  overall   precision ${pct(s.overall.precision)}  recall ${pct(s.overall.recall)}  f1 ${pct(s.overall.f1)}`);
  for (const [k, m] of Object.entries(s.byPolarity)) console.log(`  ${k.padEnd(9)} precision ${pct(m.precision)}  recall ${pct(m.recall)}`);
  for (const [k, m] of Object.entries(s.byArea)) console.log(`  ${k.padEnd(13)} precision ${pct(m.precision)}  recall ${pct(m.recall)}`);
  console.log(`  hire signal: ${pct(s.hireAgreement)} in the accepted range, ${pct(s.hireWithinOne)} within one step`);
}

function save(file: string, r: EvalResult) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(path.join(RESULTS_DIR, file), JSON.stringify(r, null, 2) + "\n");
}

async function main() {
  const dir = recordingsDir(FEEDBACK_MODEL);
  if (process.argv.includes("--record")) {
    const missing = missingRecordings(dir);
    console.log(`Recording ${missing.length} scenarios with ${FEEDBACK_MODEL} (roughly $0.08 each).`);
    await recordLive(dir, SCENARIOS.filter((s) => missing.includes(s.id)));
  }

  const heuristic = await runEval("heuristic", heuristicGrader);
  print(heuristic);
  save("heuristic.json", heuristic);

  const missing = missingRecordings(dir);
  if (missing.length) {
    console.log(`\nclaude (${FEEDBACK_MODEL}): not measured yet (awaiting API key). ${missing.length} of ${SCENARIOS.length} recordings missing in ${path.relative(process.cwd(), dir)}.`);
    return;
  }
  const claude = await runEval("claude-replay", replayGrader(dir), { model: FEEDBACK_MODEL });
  print(claude);
  save(`claude-${FEEDBACK_MODEL}.json`, claude);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
