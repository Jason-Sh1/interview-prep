# Interview Prep

An AI-personalized platform for software engineering interview prep:

- **Personalized LeetCode progression (headline feature)**: a pattern-based track that re-plans after every attempt, using mastery gating, spaced repetition (FSRS), interleaving and target-company frequency, fitted to your interview date.
- **Live voice mock interviews**: talk through your thinking with an AI interviewer that sees your code as you type.
- **Feedback on code and communication**: a report built from your code-edit timeline and the voice transcript, with focus areas fed back into your roadmap.
- **Current interview formats**: classic DSA, AI-assisted coding rounds, code comprehension and debugging, and later system design and behavioral, kept current by a weekly research job.

See [docs/SPEC.md](docs/SPEC.md) for the full product spec, research, and tech stack.

## Status

Phase 1, the practice core, is built: onboarding, a 144-problem bank over 18 patterns, an editor that runs Python and JavaScript against tests, and the adaptive daily plan with FSRS reviews.

Phase 2, live voice mock interviews, is built: an AI interviewer you talk to while coding in the same editor, which sees your code and test runs, plus a recorded timeline (code edits, snapshots, runs, and both sides of the transcript) with a replay page. Phase 3 has started: after every mock you get a feedback report built from that timeline, and its weaknesses feed back into your plan. AI-assisted coding rounds and code comprehension and debugging rounds are built too, and a weekly research job keeps company interview data current with sourced, reviewed profiles.

Phase 4 is under way: system design rounds on a shared whiteboard are built, on a conversation-round engine that the behavioral and code walkthrough rounds share.

## Running it on your computer

You need two free tools installed once: [Git](https://git-scm.com/downloads) and [Node.js](https://nodejs.org) 20 or newer (the LTS download is fine). Check them with `git --version` and `node -v`. Python is not needed; Python solutions run in the browser.

```bash
git clone https://github.com/Jason-Sh1/interview-prep.git
cd interview-prep
npm install          # also copies Monaco and Pyodide into public/vendor
npm run dev          # open http://localhost:3000
```

Stop it with Ctrl+C. Next time, just `cd interview-prep` and `npm run dev`; after pulling new changes (`git pull`), run `npm install` again first.

No other setup is needed, and there's no account to create: it runs as a single-user app, so opening it takes you straight to your plan (if you made an account before, it keeps using that one and its progress). With no `DATABASE_URL` the app uses an embedded Postgres (PGlite) stored in `./.data` (delete that folder to start over), code runs in your browser, and mock interviews use your browser's voice with a scripted interviewer.

**Optional keys.** To turn on the real features, copy the example settings and fill in what you want, then restart `npm run dev`:

```bash
cp .env.example .env.local
```

The one worth adding first is `ANTHROPIC_API_KEY` (from [console.anthropic.com](https://console.anthropic.com)): it makes Claude the mock interviewer, the feedback grader, the AI-assisted round assistant and the research job. Everything else in [.env.example](.env.example) (Postgres, Judge0, LiveKit voice, sign-in for hosted use) can stay empty. `.env.local` is ignored by Git, so keys never get committed.

### Using it day to day

1. **Goals**: set your target companies, interview date, level, language and hours per week. You can also paste LeetCode problems you've already solved so they count.
2. **Diagnostic**: three short problems and a 15-minute mock, so the plan starts at your real level instead of guessing.
3. **Today** is your daily plan. Work through it top to bottom: new problems, FSRS reviews that are due, drills from past feedback. It re-plans after every attempt, so missing a day is fine.
4. A few times a week, do a **Mock interview** (use headphones, Chrome or Edge for voice), and read the feedback report afterwards; its weak spots come back in your plan.
5. As your interview gets closer, open **Rounds** for the other formats (AI-assisted, debugging, system design and more; Today suggests which ones), and check the **Skill map** to see which patterns are weak.

### Deploying it

To use it from any device, or to share it with others, deploy to [Vercel](https://vercel.com) with a [Neon](https://neon.tech) database (free tiers work). **[DEPLOY.md](DEPLOY.md) is the step-by-step checklist.** In short:

- `DATABASE_URL` (Neon's pooled connection string), `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are required; the server won't start on Vercel without them.
- A deployed site turns accounts on (email and password). Set `SIGNUP_INVITE_CODE` so only people you give the code to can sign up and use your API key.
- `CRON_SECRET` turns on the two scheduled jobs in `vercel.json`: the weekly research run and the daily retention cleanup.
- Every setting is listed, with empty values, in [.env.example](.env.example).

Every push to `main` then redeploys. The LiveKit voice agent in `agent/` is a separate long-running process and can't run on Vercel; without it, mocks use browser voice.

### Privacy

- **Consent before recording:** the first mock interview asks for explicit consent to save its transcript, code and test runs. Audio is never stored. The server refuses to start a mock without consent.
- **Retention:** a daily job deletes recordings (mock transcripts, timelines and reports, and AI-round chats and files) older than `RETENTION_DAYS` (default 90), keeping only a content-free note that the session happened.
- **Delete my data:** Settings can delete all recordings now, or the account and every row stored with it.
- **Analytics:** admins see weekly active users and completed sessions at `/stats`, counted from the app's own tables. There are no tracking scripts or analytics cookies.
- The public [privacy page](src/app/privacy/page.tsx) (`/privacy`) explains all of this to users; code in `src/lib/privacy.ts`.

### Development checks

```bash
npm test             # engine and test-runner unit tests, plus every reference solution
npm run validate:bank
npm run eval:feedback  # feedback-quality eval (offline; see evals/feedback)
npm run lint
npm run typecheck
```

## How it fits together

| Piece | Where | Notes |
|---|---|---|
| App | Next.js 16 (App Router), React 19, Tailwind 4 | Pages in `src/app` |
| Sign-in | None by default (`AUTH_MODE=single`, one built-in user). With `AUTH_MODE=accounts`, [Better Auth](https://better-auth.com) (email + password, optional GitHub) | `src/lib/auth`; the mode is in `auth/mode.ts` |
| Database | Drizzle ORM on Postgres, or PGlite locally | Schema in `src/lib/db/schema.ts`, migrations in `drizzle/` (applied on startup) |
| Problems | TypeScript content files, one per pattern | `src/lib/problems/bank`; statements are original paraphrases that link to the public problem they're modeled on |
| Editor | Monaco, served from `public/vendor` | `src/app/problems/[slug]/Workspace.tsx` |
| Code runner | In the browser by default (JS in a Web Worker, Python via Pyodide); Judge0 on the server when `JUDGE0_URL` is set | `src/lib/runner` |
| Learning engine | Pure functions, unit tested | `src/lib/engine` |
| Mock interviews | Interviewer, timeline and prompts in `src/lib/interview`; data access in `src/lib/mock.ts` | Pages in `src/app/mock`, API in `src/app/api/mock` |
| Feedback reports | Analysis and grading in `src/lib/feedback` | Shown on the recap page, `src/app/mock/[id]` |
| Company research | Research job, versions and review queue in `src/lib/research` | Review page `src/app/research`, cron route `src/app/api/cron/research` |
| AI-assisted rounds | Tasks, assistant, harness and grading in `src/lib/assisted` | Pages in `src/app/assisted`, API in `src/app/api/assisted` |
| Conversation rounds | Shared engine (turns, time box, grading, Today suggestions) in `src/lib/rounds`; system design in `src/lib/design` | Hub `src/app/rounds`, pages `src/app/design`, API `src/app/api/rounds` |
| Voice agent | LiveKit Agents worker, its own package | `agent/` |
| Privacy and usage | Consent, retention, deletion in `src/lib/privacy.ts`; weekly counts in `src/lib/analytics.ts` | Pages `src/app/settings`, `src/app/privacy`, `src/app/stats` |
| Feedback eval | 24 labeled simulated mocks, precision/recall, replayed Claude grades | `evals/feedback`, results in [RESULTS.md](RESULTS.md) |

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

How good is the feedback? `npm run eval:feedback` scores it against 24 labeled simulated interviews; see [RESULTS.md](RESULTS.md) and [evals/feedback](evals/feedback/README.md). The numbers always come from `feedback/analyze.ts`, which is rule-based. With `ANTHROPIC_API_KEY` set, `feedback/claude.ts` also sends the transcript, test runs, code at key moments and those numbers to Claude (`claude-opus-5-5`, structured output) to write the rubric, hire signal and focus areas; if that call fails, the rule-based report is used. Reports are stored in `feedback_reports` and built once per interview.

### AI-assisted coding rounds (spec 4.5)

Modeled on the AI-enabled rounds companies such as Meta and Shopify now run: you get a small multi-file repo, a brief, and a chat assistant, and you are graded on how you use it, not only on whether the tests pass.

- **Tasks** live in `src/lib/assisted/tasks`, one file each: the starter files, visible and hidden tests, a reference solution, the requirements, and the bugs the assistant can plant. Tests in `tests/assisted.test.ts` check that each reference passes, each starter fails, and each planted bug fails a hidden test.
- **The assistant** never edits your files; you paste what you want. With `ANTHROPIC_API_KEY` set you pick a Claude model, and in some answers it is asked to slip in one subtle bug, which it labels for the grader (the label is stripped before you see it). Without a key a scripted practice assistant answers from canned replies per task and plants bugs the same way.
- **Tests run in your browser**: `assisted/harness.ts` builds a small CommonJS + Jest-style runner over the repo files and runs it in a Web Worker.
- **Recording**: prompts, answers (with planted bugs), snapshots, pastes (and whether they came from an answer) and test runs go to `assisted_events`.
- **Grading** (`assisted/grade.ts`) scores decomposition, prompt quality, review of AI output, correctness and ownership, reports every planted bug as caught, missed or not used, and gives a hire signal. With a key, Claude (`claude-opus-5-5`) writes the rubric from the same evidence, keeping the measured bug outcomes and test results.

### Conversation rounds (spec 4.5, phase 4)

System design, behavioral and code walkthrough rounds are timed conversations with an AI interviewer around something you build or bring. They share one engine (`src/lib/rounds`): a `rounds` table holding the setup, the transcript and the artifact, a streamed turn API (`POST /api/rounds/[id]/turn`), the browser-voice conversation panel, a server-enforced time box, and a report page. Each kind plugs in a `RoundKindDef` (`rounds/kind.ts`): its topics, artifact schema, Claude system prompt, scripted interviewer, rule-based grader and rubric. Find them all under **Rounds** in the nav.

- **Interviewer**: Claude (`claude-sonnet-5-5`) when `ANTHROPIC_API_KEY` is set, seeing the artifact (the whiteboard, notes or code) on every turn; otherwise a scripted interviewer per kind that follows the same arc. Voice is the browser's speech recognition and synthesis, like browser-voice mocks; typing always works.
- **Reports**: a rule-based report from the transcript and artifact (rubric, checklist, key moments, top three focus areas, hire signal calibrated by company and level). With a key, Claude (`claude-opus-5-5`) rewrites the rubric and focus areas from the same evidence, keeping the measured checks.
- **Plan**: Today suggests a round when it fits your level, your target companies' loops (from approved research) and the time left, with the last report's top focus area as a drill. Rounds never change your coding pattern ratings.

**System design** (`src/lib/design`): eight prompts (link shortener, news feed, chat, rate limiter, notifications, ride-hailing dispatch, file sync, autocomplete), each with the requirements and scale numbers the interviewer reveals when asked, the components a solid design includes, and three deep dives with what a strong answer covers. You draw on an [Excalidraw](https://excalidraw.com) whiteboard; `design/scene.ts` turns the board into text (labelled boxes and the arrows between them) for the interviewer and the grader. The scripted interviewer moves through requirements, estimates, API and data model, high-level design, deep dives, scale and failure, and a wrap-up, asks about core components it can't find on the board, and keeps to the clock. The report shows your final board, which components were drawn, only mentioned or missing, how much of each deep dive you covered, and a reference outline.

### Keeping interview data current (spec 4.6)

Company profiles (each company's pattern mix, loop, and AI tool policy) are versioned in `company_profiles`. Version 1 of each is the hand estimate in `engine/companies.ts`.

- **Research runs** (`research/claude.ts`, needs `ANTHROPIC_API_KEY`): for each company, Claude (`claude-opus-5-5`, override with `RESEARCH_MODEL`) searches the web for reports from the last 12 months and writes notes with sources. A second call turns the notes into a structured profile. Any source that wasn't actually returned by a search is dropped, and a profile with no verified source is discarded.
- **Review queue** (`/research`): a profile that changes something (an AI policy, a pattern weight moving by 0.15 or more, a new loop description or note) waits there as a pending version, showing what changed, a before/after view and its sources. Approving it updates every user's plan and the skill map. A profile that still holds just gets its "last verified" date and sources refreshed. In single-user mode, you are the reviewer. With accounts, reviewers are the emails in `ADMIN_EMAILS`, signed in with GitHub so the address is verified (email and password accounts aren't); with that unset, anyone signed in can review in development, and nobody can in production.
- **Schedule**: `vercel.json` calls `/api/cron/research` every Monday, authorized by `CRON_SECRET`. Any scheduler can call it the same way, with `Authorization: Bearer $CRON_SECRET`. Run it by hand from `/research` or with `npm run research [company-id ...]`.
- **What users see**: a "What's new in interviews" panel on Today for approved changes from the last 45 days (target companies first), and "verified" dates with sources on the skill map.

