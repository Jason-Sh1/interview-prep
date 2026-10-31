# Results

Measured numbers only. Anything not yet measured says so.

## Feedback quality (evals/feedback)

How well the mock-interview feedback matches what a calibrated human interviewer would say, on 24 simulated sessions. See [evals/feedback/README.md](evals/feedback/README.md) for the method, and [DESIGN.md](DESIGN.md#feedback-quality-eval) for why.

> **Labels are drafts awaiting human review** (0 of 24 reviewed). These numbers are provisional and will change once the labels are checked.

Run on 2026-10-31 with `npm run eval:feedback`, labels version `709a56b37248`. Raw results: [evals/feedback/results/heuristic.json](evals/feedback/results/heuristic.json).

| Grader | Precision | Recall | F1 | Hire signal in accepted range | Within one step |
|---|---|---|---|---|---|
| Rule-based (`feedback/analyze.ts`, used without an API key) | 64.9% | 84.5% | 73.4% | 66.7% | 100% |
| Claude (`claude-opus-5-5`, used with an API key) | not measured yet (awaiting API key) | | | | |

Rule-based grader by area:

| Area | Precision | Recall |
|---|---|---|
| Problem understanding | 66.7% | 87.5% |
| Approach | 82.6% | 95.0% |
| Correctness | 81.8% | 100.0% |
| Testing and edge cases | 41.7% | 76.9% |
| Complexity analysis | 78.3% | 85.7% |
| Communication | 38.1% | 53.3% |
| *Strengths overall* | 72.7% | 83.6% |
| *Weaknesses overall* | 54.4% | 86.1% |

What the misses show (from the per-session results):

- **It catches most real problems but over-reports weaknesses** (weakness precision 54%). It always lists three focus areas even when the third is at the bar, so it often flags testing or understanding that a human would let pass.
- **Communication is its weakest area** (38% precision, 53% recall). It can't hear rambling, deflecting or arguing with the interviewer (sessions 13, 20, 23), and it counts "quiet while typing" against strong, focused candidates (22, 24).
- **Speech-to-text formatting fools it:** clarifying questions without a question mark (session 03) and complexities said as "rows times columns" (07, 24) aren't recognised.
- **Typed messages count against testing:** a candidate who typed an edge-case trace instead of speaking it got no credit (12).
- **Hire signal:** two thirds land in the accepted range and all are within one step; the misses are too generous, mostly when it can't see the communication problems above (04, 06, 09, 13, 14, 20, 21, 24).

## Tests

`npm test` has 18 test files; see the PR's CI checks for the latest run. On a heavily loaded Windows machine, a few database-backed tests can exceed the 60-second timeout when files run in parallel; each passes when run on its own.
