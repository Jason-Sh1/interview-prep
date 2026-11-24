# Design decisions

Each entry: what we chose, what else we could have done, and why, in plain words. Covers the production-readiness work (deploying for real users, privacy, analytics, and the feedback eval). The product design itself is in [docs/SPEC.md](docs/SPEC.md).

## Hosting: Vercel + Neon

- **Choice:** the Next.js app on Vercel, Postgres on Neon, both on free tiers.
- **Alternatives:** a single VPS (Fly.io, Railway) running the app and Postgres; Supabase for the database and auth.
- **Why:** Vercel deploys every push to `main` with no server to manage, and runs the two scheduled jobs from `vercel.json`. Neon is plain Postgres with a pooled connection string, which serverless functions need (each function instance opens its own connection, so a pooler stops them exhausting the database). Supabase would also work. We already use Drizzle and Better Auth, so we didn't need its auth or row-level security, and plain Postgres keeps us portable. The trade-off: long-running processes (the LiveKit voice agent, Judge0) can't run on Vercel, so they stay optional and the app falls back to browser voice and in-browser code execution. The Hobby plan also stops any function after 300 seconds and runs cron jobs at most once a day, so the research job, which can take longer than that for all ten companies, runs every weekday: each call skips companies researched in the last 6 days, goes oldest first, and stops starting new companies after 150 seconds (recording the rest as deferred). How long one company takes hasn't been measured yet, so whether two or ten fit in a call is unknown until the first real run.

## Accounts: Better Auth, invite-only, rate-limited in Postgres

- **Choice:** email and password through Better Auth (already in the app), optional GitHub sign-in, an optional invite code (`SIGNUP_INVITE_CODE`), and per-IP rate limits on sign-in (30 per minute) and sign-up (60 per hour) stored in a `rate_limit` table.
- **Alternatives:** open sign-up; an email allowlist; magic links; a hosted auth provider (Clerk, Auth0).
- **Why:**
  - **Invite code instead of open sign-up:** every user can spend the owner's Claude budget ($20/month across all projects), so the site shouldn't be open to the whole internet. A shared code is the simplest gate for a club: no list of emails to maintain.
  - **Limits sized for shared Wi-Fi:** club members often share one public IP (campus Wi-Fi, a meetup), so the limits let about forty people sign up in the same hour and sign in in the same minute. The invite code is what keeps strangers out of sign-up; the sign-in limit still caps password guessing from one address at 30 tries a minute.
  - **Rate limits in the database, not in memory:** on serverless, each instance has its own memory, so an in-memory limit is easy to get around by spreading requests across instances. A Postgres table is shared by every instance and costs one small write per auth request.
  - **Magic links** need an email-sending service, meaning another account and another secret.
  - **GitHub and the invite code:** a GitHub login can't carry an invite code, so with a code set, GitHub only signs in existing accounts. Admin pages need a GitHub-verified email, because anyone can register a password account with someone else's address. Better Auth won't silently attach a GitHub login to an unverified account (that would let an attacker pre-register your email). So the admin signs up with a password, then links GitHub from Settings while signed in. Better Auth only links when GitHub reports the same email and says it's verified, but it doesn't mark the local email verified until a later GitHub sign-in, so a small hook (`lib/auth/github-link.ts`) marks it verified when a GitHub login is linked to a password account.
- **Fail fast on bad config:** at startup the server checks that Vercel has `DATABASE_URL`, a 32+ character `BETTER_AUTH_SECRET` and a site URL, and refuses to start with a message naming what's missing. Running with a default secret or a throwaway database is worse than not running. Missing optional pieces (invite code, cron secret) only log warnings.

## Scheduled jobs protected by one secret

- **Choice:** `/api/cron/research` (weekly) and `/api/cron/retention` (daily) both require `Authorization: Bearer $CRON_SECRET`, compared in constant time. With no secret set, both refuse every call.
- **Alternatives:** checking Vercel's cron user-agent; IP allowlists; no protection ("nobody knows the URL").
- **Why:** headers like user-agent can be faked, and URLs leak. Vercel sends the bearer token automatically, and any other scheduler can do the same, so we're not tied to Vercel. "Off unless configured" means a forgotten secret can't leave the job open.

## Consent before recording

- **Choice:** a mock interview, system design round or behavioral round can't start until the user ticks a consent box once. The box explains that the transcript and the work (code and test runs, or the whiteboard or story notes) are saved, that audio is never stored, who processes the speech (the browser's speech service or LiveKit) and the transcript (Anthropic, when a key is set), and the retention period. Consent is stored per user with a version number. The check is on the server, in `createMockSession` and `createRound`, not just in the form; a start without consent goes back to the page with a note saying why.
- **Alternatives:** a line in the terms at sign-up; asking before every mock.
- **Why:** voice transcripts are more sensitive than practice attempts, so they get their own explicit, specific opt-in rather than being buried in a sign-up checkbox. Asking every time is tiring, and people stop reading. The version number means a materially changed consent text can ask everyone again. Enforcing on the server means no other code path (the diagnostic's mock, a future API) can skip it. Consent can be withdrawn in Settings; practice problems and the AI-assisted and debugging rounds (typed chat, no voice) keep working without it.

## Retention: delete the content, keep a content-free row

- **Choice:** recordings older than `RETENTION_DAYS` (default 90) are deleted: mock timelines (transcript, edits, runs), feedback reports (they quote the transcript), the chats, files and answers from AI-assisted and debugging rounds, and the transcripts, whiteboards, notes and reports of conversation rounds (system design, behavioral). The purge runs from two places: a daily Vercel cron job (`/api/cron/retention`, only when `CRON_SECRET` is set) and, after any signed-in page load, at most once a day per server instance (`lib/retention-schedule.ts`, using Next's `after()` so the page isn't slowed). The session row stays, with the problem, dates and a `purged_at` time, but no content.
- **Alternatives:** delete whole session rows; keep everything forever; per-user retention settings.
- **Why:** deleting whole rows would quietly rewrite history: usage counts, "you've done 12 mocks" and the plan's record of what you practiced would all change. The row says that a session happened, not what was said. The rating changes a mock already made stay, because they're part of the learning model, not the recording. The recap page shows "this recording was deleted" instead of trying to rebuild a report from nothing (report generation refuses purged sessions, and a report that was still being graded when the purge ran is not written: each builder stores it only if the session is still not purged, and a mock checks again after writing its drills). The purge marks a session purged before deleting its content, and every run also deletes any content still attached to an already purged session, so a run that stopped halfway or a write that raced it is cleaned up by the next run. A purge also ends a session that is still open, and the write paths refuse purged rows, so nothing more is recorded into the emptied row; "Delete all my recordings now" in Settings asks for a confirming tick first. The page-load check exists because the cron job silently doesn't run without `CRON_SECRET`, and the privacy page promises deletion either way; the privacy page, Settings and the consent box say which of the two is in effect. Ninety days covers a typical interview-prep window. It's one setting, not per user, to keep things simple.

## Delete my data: lean on cascades

- **Choice:** "Delete everything" in Settings deletes the user row. Every table that stores user data references `user.id` with `ON DELETE CASCADE`, so goals, attempts, reviews, ratings, mocks, timelines, reports, drills, AI rounds, consent, sessions and accounts all go in one statement. The one place an email appears outside those tables (who approved a research profile) is replaced with "deleted user". A test reads the migrated database's foreign keys and fails if any table with a `user_id` column lacks a cascading foreign key to `user` (or a table hanging off one, like timeline events, doesn't cascade from it); another deletes a user with a recorded mock and checks their rows are gone and a second user is untouched.
- **Alternatives:** a list of per-table deletes in application code; soft delete (a `deleted_at` flag).
- **Why:** a hand-written list of deletes goes stale the moment someone adds a table. A cascade is declared once, next to the foreign key. Soft delete keeps the data, which is exactly what the user asked us not to do. Deleting also ends the session, since session rows cascade too. The user must type "delete" to confirm.

## Analytics: count from our own tables

- **Choice:** an admin-only `/stats` page with weekly active users and sessions completed (mock interviews plus AI-assisted, debugging, system design and behavioral rounds, each counted under its own kind; practice attempts listed separately) for the last eight weeks. It's computed from tables we already have: attempts, mock sessions and rounds.
- **Alternatives:** Google Analytics, Plausible or PostHog; an `events` table logging page views.
- **Why:** the two questions we care about ("are people coming back each week?" and "are they finishing sessions?") are already answered by the data the app keeps to work at all. Third-party analytics would mean a script on every page, sending browsing data to another company, plus a cookie banner. A page-view log would be a new pile of personal data to protect and delete. The query reads only a user id, a time and whether a session ended, and the page shows totals only. One consequence: a deleted account's history drops out of past weeks' numbers. That's the privacy-respecting behavior, and it's fine at club scale.

## Feedback-quality eval

- **Choice:** 24 simulated mock interviews written as short scripts, each labeled with the feedback points a calibrated human interviewer would give: for each of the six rubric areas, a strength, a weakness, or nothing worth saying, plus the hire signals that would be reasonable. A grader's report is turned into the same kind of points (a score of 1–2 or a top focus area is a weakness; a 4 that isn't a focus area is a strength), and we measure precision (of what it said, how much a human would say too) and recall (of what a human would say, how much it said).
- **Alternatives:**
  - **Compare 1–4 scores exactly:** too strict. A 3 vs. a 4 is often a judgment call, and users act on "what should I work on", not on the number.
  - **LLM-as-judge on free text:** the judge needs its own eval, costs money on every run, and isn't deterministic.
  - **Real recorded mocks:** the best data, but we don't have users yet, and real transcripts are personal data.
- **Why scripts:** they're readable and reviewable (a person can check a label in a minute), they cover the cases we care about on purpose (silent coders, a wrong complexity claim, typing instead of talking, speech-to-text dropping punctuation), and they turn into exactly the timeline a real recording produces, so graders run unchanged.
- **Why record and replay for Claude:** a grading call costs money (how much is not measured yet) and isn't deterministic. So the harness calls Claude once per scenario (`--record`), saves each response, and replays them through the same `mergeGrade` code the app uses. After one recording, re-scoring is free, deterministic, and runs in CI. To support this, the Claude grader was split into `requestGrade` (the API call) and `mergeGrade` (pure: merges Claude's grade over the measured numbers and caps the hire signal by the outcome).
- **Honesty about labels:** the labels were drafted by an AI assistant from the scripts, without looking at any grader's output, and every scenario is marked `reviewed: false` until a human checks it. Results are tagged with a hash of the labels, and a test fails if the stored results don't match the current labels and grader, so numbers can't silently go stale.

## Budget guardrails

- The hard cap on Claude spending is the monthly spend limit in the Anthropic console (DEPLOY.md, step 6), since the app has no per-user quota yet. The invite code limits who can spend at all.
- Every Claude feature has a free fallback (scripted interviewer, rule-based report, scripted assistants), so the app is fully usable with no key, and tests never call the API.
- The one planned real-model run is recording the feedback eval: 24 grading calls on `claude-opus-5-5`, recorded once. Its cost is not measured yet; the console spend limit caps it.
