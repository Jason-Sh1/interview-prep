# Feedback-quality eval

Measures how well the mock-interview feedback matches what a calibrated human interviewer would say.

- `scenarios.ts`: 24 simulated mock interviews, written as short scripts (who said what, code typed, test runs), each with **draft labels**: the strengths and weaknesses a human interviewer would point out per rubric area, plus the hire signals they could reasonably give.
- `dsl.ts`: turns a script into the same timeline events a real recording has.
- `score.ts`: precision and recall of a grader's feedback points against the labels.
- `harness.ts`: runs a grader over every scenario. The heuristic grader runs offline. Claude is scored by **replaying recorded responses** through the app's own merge code, so scoring never calls the API.
- `results/`: the latest results per grader (written by the script, checked by `tests/eval-feedback.test.ts`).
- `recordings/<model>/`: Claude's recorded grades, one JSON file per scenario. There are none yet (no API key).

## Running it

```bash
npm run eval:feedback               # free: heuristic, plus Claude replayed if every recording exists
npm run eval:feedback -- --record   # needs ANTHROPIC_API_KEY: records missing scenarios, then scores
```

Recording all 24 on `claude-opus-5-5` costs about $2 (about 5k input and 3k output tokens each, at $4 and $20 per million). Each scenario is recorded once and then replayed for free.

## How a report becomes feedback points

For each of the six rubric areas: a score of 1–2, or being one of the report's top focus areas, counts as a **weakness**; a score of 4 that isn't a focus area counts as a **strength**; a 3 says nothing. A point matches a label when the area and the direction agree.

## Reviewing the labels (needs a human)

The labels were drafted by an AI assistant from each script, without looking at any grader's output. To review one: read the scenario's script, then for each rubric area decide whether you would tell this candidate it was a strength, a weakness, or nothing worth saying, and whether the `hire` range is right. Fix the labels in place, set `reviewed: true`, and re-run `npm run eval:feedback` (the stored results change with the labels, and the test checks they match).
