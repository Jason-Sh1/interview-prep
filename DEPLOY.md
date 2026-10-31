# Deploying to Vercel + Neon

A checklist to put Interview Prep online for real users (for example, Claude Builder Club members). Follow it top to bottom. It takes about 30 minutes, and everything in it fits in the free tiers. Nothing here has been done for you: you create the accounts and paste the values.

You need: the GitHub repo (`Jason-Sh1/interview-prep`), a terminal with `openssl` (Git Bash on Windows has it), and a browser.

## 1. Create the database (Neon)

1. Sign up at [neon.tech](https://neon.tech) (free plan; signing in with GitHub works).
2. **Create project** → name it `interview-prep`. Pick the region closest to your users (for example `AWS US East (N. Virginia)`) and remember it: Vercel's functions should run in the same region (step 3.6).
3. On the project dashboard, click **Connect**, keep the defaults (branch `main`, database `neondb`), turn **Connection pooling on**, and copy the connection string. It looks like `postgresql://neondb_owner:…@ep-…-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require`.
4. Keep it somewhere private for step 3. Don't paste it into any file in the repo.

You don't need to create tables: the app applies its migrations on startup.

## 2. Generate the secrets

Run each of these once, and keep the outputs for step 3:

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -hex 32      # CRON_SECRET
openssl rand -hex 6       # SIGNUP_INVITE_CODE (or pick a phrase you'll share with the club)
```

## 3. Create the Vercel project

1. Sign up at [vercel.com](https://vercel.com) with GitHub (Hobby plan, free).
2. **Add New… → Project** → import `Jason-Sh1/interview-prep`. Framework preset: Next.js (detected). Leave the build settings as they are.
3. Before clicking Deploy, open **Environment Variables** and add these for **Production** (and Preview, if you want preview deploys to work):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon pooled connection string from step 1 |
   | `BETTER_AUTH_SECRET` | the base64 secret from step 2 |
   | `BETTER_AUTH_URL` | `https://<project-name>.vercel.app` (the domain Vercel shows; update it if you add a custom domain) |
   | `SIGNUP_INVITE_CODE` | the invite code from step 2 |
   | `CRON_SECRET` | the hex secret from step 2 |
   | `RETENTION_DAYS` | `90` (or shorter if you prefer) |
   | `ADMIN_EMAILS` | your email, to use `/research` and `/stats` (needs GitHub sign-in, step 5) |

   Leave `AUTH_MODE` unset: on Vercel the app requires accounts by default. Leave `ANTHROPIC_API_KEY` unset for now (step 6).
4. Click **Deploy**. When it finishes, open the site. If a required setting is missing, the function logs (Project → **Logs**) show a `Missing production settings` message naming it.
5. Back in the project, open **Settings → Cron Jobs** and check both jobs are listed: `/api/cron/research` (Mondays) and `/api/cron/retention` (daily). They're read from `vercel.json`.
6. Under **Settings → Functions**, set **Function Region** to the same region as the Neon database, then redeploy (Deployments → ⋯ → Redeploy).

## 4. Check it works

1. Open the site: you should get the landing page with **Get started**.
2. Create an account with the invite code. Trying without it (or with a wrong one) should say the code isn't right.
3. Set goals → the diagnostic page shows step 2 of 3 → skip it → **Today** shows your plan.
4. Go to **Mock interview**: the consent box appears. Tick it, start, say something or type, end the interview, and check the report appears.
5. **Settings**: consent shows as on; **Delete all my recordings now** works; the privacy link opens `/privacy`.
6. Check the retention job is protected (replace the URL and secret):

   ```bash
   curl -i https://<your-app>.vercel.app/api/cron/retention                       # expect 401
   curl -i -H "Authorization: Bearer <CRON_SECRET>" https://<your-app>.vercel.app/api/cron/retention   # expect 200 and {"retentionDays":90,...}
   ```

7. Optional: make a throwaway account and use **Delete everything** in Settings to check it signs you out and the account is gone.

## 5. Optional: GitHub sign-in (needed for admin pages)

Admin pages (`/research`, `/stats`) need an email verified by GitHub, so password accounts can't claim your address.

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - Homepage URL: `https://<your-app>.vercel.app`
   - Authorization callback URL: `https://<your-app>.vercel.app/api/auth/callback/github`
2. Copy the Client ID, generate a client secret, and add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in Vercel, then redeploy.
3. With an invite code set, GitHub only signs in **existing** accounts. So sign up with email and password first, using the same email as your GitHub account's primary email, then go to **Settings → Link GitHub**. Once linked, your email counts as verified, `/research` and **Usage** appear in the menu, and **Continue with GitHub** signs you in.

## 6. Optional: turn on Claude (when you have an API key)

Without a key, every feature works with its scripted or rule-based fallback. With one, Claude runs the interviewer, the feedback grader, the round assistants, review variants and the research job, and every user's use is charged to your key.

1. At [console.anthropic.com](https://console.anthropic.com): create a key, then under **Limits** set a **monthly spend limit** that fits the budget (for example $15, leaving room for evals). That limit is the real cap; the app has no per-user quota yet.
2. Add `ANTHROPIC_API_KEY` in Vercel and redeploy.
3. Rough costs: about $0.30–0.80 per mock report on Opus, plus interviewer turns. Keep the invite code set so only club members can sign up.
4. To measure the Claude grader once (about $2): locally, put the key in `.env.local` and run `npm run eval:feedback -- --record`. Commit the recordings under `evals/feedback/recordings/` and the new results, and update RESULTS.md.

## 7. Day to day

- Every push to `main` redeploys. Pull requests get preview deploys (they share the production database unless you give Preview its own `DATABASE_URL`, for example a Neon branch).
- To invite people, share the site URL and the invite code. To stop new sign-ups, change `SIGNUP_INVITE_CODE` and redeploy.
- Usage: `/stats` (admins) shows weekly active users and completed sessions.
- The LiveKit voice agent (`agent/`) can't run on Vercel. Without it, mocks use the browser's voice, which is fine for most users.

## Settings reference

Every setting, with what it does, is in [.env.example](.env.example). Required on Vercel: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (or the default Vercel domain). Strongly recommended: `SIGNUP_INVITE_CODE`, `CRON_SECRET`.
