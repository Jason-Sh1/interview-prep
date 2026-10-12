# Interview Prep

An AI-personalized platform for software engineering interview prep:

- **Personalized LeetCode progression (headline feature)**: a pattern-based track that re-plans after every attempt, using mastery gating, spaced repetition (FSRS), interleaving and target-company frequency, fitted to your interview date.
- **Live voice mock interviews**: talk through your thinking with an AI interviewer that sees your code as you type.
- **Feedback on code and communication**: a report built from your code-edit timeline and the voice transcript, with focus areas fed back into your roadmap.
- **Current interview formats**: classic DSA, AI-assisted coding rounds, code comprehension and debugging, and later system design and behavioral, kept current by a weekly research job.

See [docs/SPEC.md](docs/SPEC.md) for the full product spec, research, and tech stack.

## Status

Phase 1, the practice core, is built: sign-in, onboarding, a 55-problem bank over 18 patterns, an editor that runs Python and JavaScript against tests, and the adaptive daily plan with FSRS reviews.

Phase 2, live voice mock interviews, is built: an AI interviewer you talk to while coding in the same editor, which sees your code and test runs, plus a recorded timeline (code edits, snapshots, runs, and both sides of the transcript) with a replay page. Phase 3 has started: after every mock you get a feedback report built from that timeline, and its weaknesses feed back into your plan. Next up: AI-assisted coding rounds and the research job that keeps company data current.

## Running it

Requires Node 20+.

```bash
npm install          # also copies Monaco and Pyodide into public/vendor
npm run dev          # http://localhost:3000
```

No other setup is needed: with no `DATABASE_URL` the app uses an embedded Postgres (PGlite) stored in `./.data`, code runs in your browser, and mock interviews use your browser's voice with a scripted interviewer. See [.env.example](.env.example) for the optional settings (Postgres, GitHub sign-in, Judge0, Claude, LiveKit). Production needs `BETTER_AUTH_SECRET`.

```bash
npm test             # engine and test-runner unit tests, plus every reference solution
npm run validate:bank
npm run lint
npm run typecheck
```

## How it fits together

| Piece | Where | Notes |
|---|---|---|
| App | Next.js 16 (App Router), React 19, Tailwind 4 | Pages in `src/app` |
| Sign-in | [Better Auth](https://better-auth.com) (email + password, optional GitHub) | `src/lib/auth` |
| Database | Drizzle ORM on Postgres, or PGlite locally | Schema in `src/lib/db/schema.ts`, migrations in `drizzle/` (applied on startup) |
| Problems | TypeScript content files, one per pattern | `src/lib/problems/bank`; statements are original paraphrases that link to the public problem they're modeled on |
| Editor | Monaco, served from `public/vendor` | `src/app/problems/[slug]/Workspace.tsx` |
| Code runner | In the browser by default (JS in a Web Worker, Python via Pyodide); Judge0 on the server when `JUDGE0_URL` is set | `src/lib/runner` |
| Learning engine | Pure functions, unit tested | `src/lib/engine` |
| Mock interviews | Interviewer, timeline and prompts in `src/lib/interview`; data access in `src/lib/mock.ts` | Pages in `src/app/mock`, API in `src/app/api/mock` |
| Feedback reports | Analysis and grading in `src/lib/feedback` | Shown on the recap page, `src/app/mock/[id]` |
| Voice agent | LiveKit Agents worker, its own package | `agent/` |

### The learning engine (spec 4.2)

- **Skill model** (`engine/rating.ts`): each pattern has an Elo-style rating and an uncertainty. Every attempt gets a score from 0 to 1 (hints, failed runs, a wrong complexity answer and going over time lower it), and the rating moves by how much that beats the expected solve chance. Quick, clean first-try solves fast-track: a bigger rating jump and a longer review interval.
- **Mastery gating** (`engine/mastery.ts`): 18 patterns in a prerequisite graph with five foundational roots. A pattern opens when its prerequisites reach a working rating; inside a pattern, problems open when they're within 300 points of your rating.
- **Spaced repetition** (`engine/fsrs.ts`): solved problems become FSRS cards (`ts-fsrs`). Your 1–4 confidence is the grade; hints cap it, so using one brings the review sooner. Reviews can be re-implemented, or explained out loud in two minutes and self-graded.
- **Next-problem selection** (`engine/planner.ts`): each candidate is scored with the spec's formula (weakness, company frequency, difficulty fit around a 70% solve chance, review due, interleaving, novelty, minus recently seen). The weights shift with time to the interview: build breadth, then strengthen, then a final stretch of reviews and company-frequent problems. The day is filled to your time budget, spreading patterns.
- **Adapts continuously**: the plan is recomputed on every page load and after every attempt. Missed days just leave more reviews due, and the budget caps how many land in a day. Two misses in a row in a pattern trigger a bridge problem and a concept refresher. Learned patterns come back as mixed practice with the pattern hidden, and you're asked to name it afterward.
- **Company profiles** (`engine/companies.ts`) are hand-made estimates for now; the weekly research job (spec 4.6) will replace them with sourced data.

### Adding problems

Add an entry to the pattern's file in `src/lib/problems/bank`, with a JavaScript `reference` solution, then run `npm run validate:bank`. It runs the reference through the real test driver against every test.

### Mock interviews (spec 4.3)

Start one from **Mock interview** in the nav. You pick the problem (the plan's next one by default), length, persona, company style and whether hints are allowed. The interviewer opens, answers clarifying questions, asks for your approach and its complexity, mostly listens while you code, reacts to your test runs, nudges you after about 40 seconds of silence, gives tiered hints if allowed, and starts wrapping up two minutes before the end.

Two pieces switch on with environment variables, and each has a fallback so `npm run dev` works with no keys:

| Piece | With keys | Without keys |
|---|---|---|
| Interviewer | Claude (`claude-sonnet-5-5`, low effort, streamed) when `ANTHROPIC_API_KEY` is set. Each turn gets the live code, the last test run, the clock and the transcript so far. If a call fails, that turn falls back to the scripted reply. | A scripted interviewer (`interview/scripted.ts`) that follows the same interview arc with keyword and code checks (it spots nested loops, parses spoken complexities like "n log n", answers clarifying questions from the constraints and test labels). |
| Voice | LiveKit when `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and `INTERVIEWER_AGENT_SECRET` are set and the agent worker is running. Speech-to-text and text-to-speech run on LiveKit Inference (Deepgram Nova 3 and Cartesia Sonic 3 by default), so no separate STT or TTS keys. | The browser's Web Speech API: speech recognition (Chrome, Edge, Safari) and speech synthesis, speaking each sentence as it streams in. You can always type instead. Use headphones; "talk over the interviewer" turns on barge-in. |

Running the LiveKit voice agent:

```bash
cd agent
npm install
cp .env.example .env.local   # LiveKit keys, APP_URL and the same INTERVIEWER_AGENT_SECRET as the app
npm run dev
```

The agent only moves audio. For every turn it calls the app's `POST /api/mock/[id]/turn` (authenticated by `INTERVIEWER_AGENT_SECRET`), so Claude, the live code context and the recording all stay in one place. The page sends event turns (test runs, silence, wrap-up) and typed messages to the agent over LiveKit data messages.

**Recording.** Every session writes an append-only timeline to `session_events`: each Monaco change as an edit (offset, length, text), a full snapshot every 15 seconds of editing and at every run, test runs with verdicts and failing case labels, transcript segments from both speakers, and markers (start, language switch, barge-in, end). `interview/timeline.ts` rebuilds the code at any moment; the replay page and the feedback report use it.

### Feedback reports (spec 4.4)

When a mock ends, its recap page builds a report from the recorded timeline:

- **Rubric scores** from 1 to 4 for problem understanding, approach, correctness, testing and edge cases, complexity analysis, and communication, each with the evidence behind it.
- **Communication under pressure**: time to the first clarifying question, whether you explained the approach before coding, silent stretches over 45 seconds (and whether they came right after a failed test), whether you narrated while debugging, filler words per 100, speaking pace, your share of the talking, and the complexity you stated.
- **Key moments** you can click to jump the replay to, a **hire signal** (strong no to strong hire) with reasons, calibrated by company and level, and the **top three focus areas** with drills.
- **Fed back into your plan**: a weak mock lowers that pattern's rating (a mock never raises it; practice attempts do that), and an unsolved or shaky problem comes back as a re-solve due today.

The numbers always come from `feedback/analyze.ts`, which is rule-based. With `ANTHROPIC_API_KEY` set, `feedback/claude.ts` also sends the transcript, test runs, code at key moments and those numbers to Claude (`claude-opus-5-5`, structured output) to write the rubric, hire signal and focus areas; if that call fails, the rule-based report is used. Reports are stored in `feedback_reports` and built once per interview.
