# Interview Prep

An AI-personalized platform for software engineering interview prep:

- **Personalized LeetCode progression (headline feature)**: a pattern-based track that re-plans after every attempt, using mastery gating, spaced repetition (FSRS), interleaving and target-company frequency, fitted to your interview date.
- **Live voice mock interviews**: talk through your thinking with an AI interviewer that sees your code as you type.
- **Feedback on code and communication**: a report built from your code-edit timeline and the voice transcript, with focus areas fed back into your roadmap.
- **Current interview formats**: classic DSA, AI-assisted coding rounds, code comprehension and debugging, and later system design and behavioral, kept current by a weekly research job.

See [docs/SPEC.md](docs/SPEC.md) for the full product spec, research, and tech stack.

## Status

Phase 1, the practice core, is built: sign-in, onboarding, a 55-problem bank over 18 patterns, an editor that runs Python and JavaScript against tests, and the adaptive daily plan with FSRS reviews. Next up: live voice mock interviews (phase 2).

## Running it

Requires Node 20+.

```bash
npm install          # also copies Monaco and Pyodide into public/vendor
npm run dev          # http://localhost:3000
```

No other setup is needed: with no `DATABASE_URL` the app uses an embedded Postgres (PGlite) stored in `./.data`, and code runs in your browser. See [.env.example](.env.example) for the optional settings (Postgres, GitHub sign-in, Judge0). Production needs `BETTER_AUTH_SECRET`.

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

### The learning engine (spec 4.2)

- **Skill model** (`engine/rating.ts`): each pattern has an Elo-style rating and an uncertainty. Every attempt gets a score from 0 to 1 (hints, failed runs, a wrong complexity answer and going over time lower it), and the rating moves by how much that beats the expected solve chance. Quick, clean first-try solves fast-track: a bigger rating jump and a longer review interval.
- **Mastery gating** (`engine/mastery.ts`): 18 patterns in a prerequisite graph with five foundational roots. A pattern opens when its prerequisites reach a working rating; inside a pattern, problems open when they're within 300 points of your rating.
- **Spaced repetition** (`engine/fsrs.ts`): solved problems become FSRS cards (`ts-fsrs`). Your 1–4 confidence is the grade; hints cap it, so using one brings the review sooner. Reviews can be re-implemented, or explained out loud in two minutes and self-graded.
- **Next-problem selection** (`engine/planner.ts`): each candidate is scored with the spec's formula (weakness, company frequency, difficulty fit around a 70% solve chance, review due, interleaving, novelty, minus recently seen). The weights shift with time to the interview: build breadth, then strengthen, then a final stretch of reviews and company-frequent problems. The day is filled to your time budget, spreading patterns.
- **Adapts continuously**: the plan is recomputed on every page load and after every attempt. Missed days just leave more reviews due, and the budget caps how many land in a day. Two misses in a row in a pattern trigger a bridge problem and a concept refresher. Learned patterns come back as mixed practice with the pattern hidden, and you're asked to name it afterward.
- **Company profiles** (`engine/companies.ts`) are hand-made estimates for now; the weekly research job (spec 4.6) will replace them with sourced data.

### Adding problems

Add an entry to the pattern's file in `src/lib/problems/bank`, with a JavaScript `reference` solution, then run `npm run validate:bank`. It runs the reference through the real test driver against every test.
