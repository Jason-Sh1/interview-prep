# Interview Prep: Product Spec

_Status: draft v1 · October 2026_

An AI-personalized platform for software engineering interview prep. Its headline feature is a LeetCode progression that adapts to every attempt you make. It also runs live voice mock interviews while you code, and gives feedback on both your code and how you communicated under pressure. It covers the interview formats companies actually run in 2026, including AI-assisted coding rounds, and keeps its question and format data current.

---

## 1. What interviews look like in 2026

The research below drives what the product must cover. Sources are listed at the end.

| Shift | What it means for prep |
|---|---|
| **AI-assisted coding rounds are real.** Meta added an AI-enabled round in Oct 2025 (60 min, CoderPad with a built-in assistant offering several models, multi-file codebase tasks, the candidate must paste code themselves). Google is piloting a Gemini-assisted *code comprehension* round for junior and mid-level US roles in 2026. Canva, Shopify, Rippling and Coinbase allow or expect AI tools in some rounds. | A dedicated format: work in an unfamiliar multi-file repo with an AI assistant; graded on prompting strategy, catching model errors, and owning the final code. |
| **Classic algorithm rounds remain, with AI off.** Big tech still runs standardized LeetCode-style loops; the bar is higher in a tighter market, and borderline performances are rejected. | The roadmap and live mocks for classic DSA stay the core. |
| **AI-resistant variants.** "Debug this code", read-and-extend existing code, and heavy probing of reasoning and complexity trade-offs. | Problem types beyond "solve from scratch": debugging, code reading, follow-up variations. |
| **System design is moving earlier,** now showing up in mid-level and new-grad loops. | A system design mode (whiteboard + voice) in a later phase. |
| **Structured behavioral rounds carry real weight** (Amazon-style principles, concrete stories, follow-ups). | A behavioral mode with a story bank and follow-up probing. |
| **Onsites are back; take-homes are declining** or come with a mandatory code walkthrough. | Practice "defend your code" walkthroughs. |
| **FAANG and startups diverge.** Big tech: AI-off algorithms. Startups: practical, AI-permitted "ship something real" rounds. | The roadmap must be target-company aware. |

## 2. The competitive gap

| Product | Live voice | Live coding | Feedback | Gap |
|---|---|---|---|---|
| interviewing.io | Human | Yes | Human, high quality | $100–225 per session |
| Pramp / Exponent | Peer | Yes | Peer, uneven | Quality depends on partner |
| Final Round AI | No | No | Generic LLM scoring | Behavioral focus; live "copilot" cheating feature |
| Yoodli | Yes | No | Speech analytics only | No technical content |
| DevInterview.AI | Yes | Yes | AI verdict | No learning plan, no code-timeline analysis |
| LeetCode, NeetCode, PracHub | No | Run tests only | Written solutions | No interview simulation |
| SpacedCode-style tools | No | No | None | Scheduling only |

**Nobody combines** (a) a truly adaptive, learning-science LeetCode progression, (b) a live voice interviewer that *sees your code as you type*, and (c) feedback that ties code edits to what you were saying at that moment. That joined-up loop is the product.

## 3. Users and goals

- **Primary:** SWE candidates (new grad to senior) preparing for a loop within 2–12 weeks.
- **Goal:** pass the real interview; the product optimizes for interview performance, not problem count.
- **Non-goal:** a live "copilot" that helps during real interviews. We will not build that.

## 4. Features

### 4.1 Onboarding and diagnostic
- Inputs: target companies and level, interview date, hours per week, preferred language, optional resume and LeetCode handle.
- A 30–40 minute diagnostic: 3–4 short problems across core patterns plus one short voice mock, giving a baseline skill estimate per pattern and per communication dimension.

### 4.2 Personalized LeetCode progression (headline feature)
The core of the product: a learning track that adapts to every attempt, so each user gets a different sequence of problems and reviews. It is built from learning-science findings and pattern-based curricula (NeetCode 150 / Grind 75 style pattern taxonomy).

**Structure**
- **Pattern-first sequencing.** About 18 patterns (two pointers, sliding window, BFS/DFS, binary search on answer, heaps, intervals, DP families, graphs, tries, union-find, and so on) in a prerequisite graph, so for example "1-D DP" unlocks only after recursion and memoization.
- **Mastery gating.** Each user has a skill rating per pattern (Elo/IRT-style, with an uncertainty value). Harder problems in a pattern unlock as the rating rises.
- **Spaced repetition.** Solved problems become review cards scheduled by **FSRS** (via the open-source `ts-fsrs` library). Reviews are short: re-derive the approach out loud in 2 minutes, or re-implement under a timer.
- **Interleaving.** Once a pattern is learned, sessions mix patterns without labels so you practice *recognizing* which pattern applies, which is the actual interview skill.
- **Retrieval before reveal.** Hints are tiered (nudge → approach → pseudocode); using one lowers the problem's score and shortens its next review interval.

**Signals collected on every attempt**
Time to first run and to an accepted answer, run count and failing test types, hints used, whether the stated complexity was correct, edge cases missed, self-rated confidence (1–4, which is also the FSRS grade), and, from mocks, communication scores per pattern.

**Next-problem selection**
A daily plan is built from a scored candidate pool; each candidate gets:

```
score = w1·pattern_weakness          (low rating or high uncertainty)
      + w2·company_frequency          (how often the target companies ask this pattern or problem)
      + w3·difficulty_fit             (predicted solve chance close to ~70%: the "desirable difficulty" zone)
      + w4·review_due                 (FSRS cards due or overdue)
      + w5·interleave_bonus           (pattern differs from recent problems)
      − w6·recently_seen
```

The weights shift with time to the interview date: early on they favor breadth and new patterns, mid-plan weakness and interleaving, and in the final two weeks reviews, company-frequent problems and mocks.

**Adapts continuously**
- The plan is recomputed after every attempt and each day. A missed day rebalances the plan instead of piling up a backlog.
- **Stuck detection:** two failed attempts in one pattern drop you to an easier "bridge" problem, or to a short concept lesson, before you retry.
- **Fast-track:** quick, clean solves on the first try skip ahead within a pattern and lengthen its review intervals.
- **Mock feedback loop:** weaknesses found in mocks (4.4) lower the matching pattern ratings and add targeted drills.
- **Variants:** an LLM generates fresh variants of solved problems (changed constraints, a follow-up twist) so reviews test understanding instead of memory.

**What the user sees**
- **Today:** a short queue (for example 2 new problems, 3 reviews, 1 timed mixed set), sized to your daily time, each with a one-line "why this problem" reason.
- **Skill map:** pattern ratings as a heat map against your target-company profile, with readiness per company.
- **Plan timeline:** weeks until the interview, with the current phase and the projected coverage of patterns.
- **Import:** an optional LeetCode username or CSV import to seed ratings from past solves, so you don't start from zero.

### 4.3 Live mock interview (voice)
- Split screen: problem statement and Monaco code editor on one side, interviewer presence and controls on the other.
- **Voice conversation** with an AI interviewer that asks clarifying questions back, probes complexity, gives calibrated hints when you're stuck, and asks follow-ups ("what if the input doesn't fit in memory?").
- **The interviewer sees your code live.** Editor state (debounced snapshots, diffs and test runs) is fed into each interviewer turn, so it can say "I see you're using a nested loop; what's the complexity?"
- Configurable: company style, difficulty, length (30/45/60 min), interviewer persona (friendly, neutral, terse), and whether hints are allowed.
- **Recording:** a timestamped event log of every keystroke-level diff, test run and transcript segment (both speakers), used for replay and feedback.
- Barge-in (you can interrupt), silence detection ("talk me through what you're thinking"), and a visible timer.

### 4.4 Feedback report
Generated after each mock from the code timeline plus transcript:

- **Rubric scores** modeled on real interviewer rubrics: problem understanding, approach and algorithm choice, code correctness and quality, testing and edge cases, complexity analysis, and communication.
- **Communication under pressure:** time to first clarifying question, silent stretches over N seconds while coding, filler-word rate, whether you stated the approach before coding, whether you narrated while debugging, and pace.
- **Timeline replay:** a scrubbable view syncing the code at each moment with the transcript, with annotated moments ("here you went silent for 2m40s after the test failed").
- **Top 3 focus areas** with concrete drills, pushed into the roadmap.
- **Hire signal:** strong no / no / lean hire / hire / strong hire, with reasons, calibrated per company and level.

### 4.5 Additional formats
| Format | Phase | Description |
|---|---|---|
| **AI-assisted coding round** | 2 | A multi-file repo (API endpoint, config, tests) in the editor with a chat assistant offering a choice of models. The candidate must paste or type AI output themselves, matching Meta's rule. Graded on decomposition, prompt quality, reviewing and correcting AI output (we plant subtle bugs in some assistant answers), and ownership in the explanation. |
| **Code comprehension and debugging** | 2 | Read an unfamiliar codebase, explain it, find and fix seeded bugs, optionally with an AI assistant (Google-style). |
| **System design** | 3 | Whiteboard canvas plus voice; interviewer drives requirements, scale, deep dives and trade-offs. |
| **Behavioral** | 3 | A story bank built from your resume, STAR structure checks, follow-up probing, per-company principle mapping. |
| **Code walkthrough** | 3 | Defend a take-home or your own project code while the interviewer probes decisions. |

### 4.6 Keeping interview data current
- A scheduled **research job** (weekly) uses an LLM with web search to collect recent reports of interview formats, policies (for example, AI-allowed rounds) and question frequencies per company, from public sources (company career pages, engineering blogs, public interview-experience write-ups).
- Output goes to versioned `company_profiles` and `question_frequency` tables with source links and dates; a human-review queue holds changes before they go live.
- Profiles drive roadmap weighting (4.2), mock configuration (4.3), and a "What's new" panel.
- Problems are paraphrased or original; we store links to public problems rather than copying copyrighted problem text.

## 5. Tech stack recommendation

| Layer | Choice | Why |
|---|---|---|
| Web app | **Next.js (App Router) + TypeScript + Tailwind** | One codebase for UI and API routes, large ecosystem, easy Vercel deploys. |
| Editor | **Monaco** | VS Code editor, good language support, change events give us diffs for the timeline. |
| Database / auth | **Postgres (Supabase or Neon) + Drizzle ORM**; Auth.js or Supabase Auth | Relational data (users, problems, attempts, reviews); row-level security on Supabase. |
| Event storage | Postgres `session_events` table (JSONB), with audio in object storage (S3/R2) | The timeline is append-only; small enough for Postgres at early scale. |
| Code execution | **Judge0** (self-hosted) to start; consider Rustbox or a hosted sandbox later | Mature, open source, 90+ languages, structured verdicts. Needs hardening; keep it isolated and patched. Python, JS/TS, Java, C++, Go first. |
| Voice transport | **LiveKit** (WebRTC) with **LiveKit Agents** | Open source, low latency, swappable STT/LLM/TTS, record and transcribe built in, self-hostable later. |
| Speech-to-text | **Deepgram** or **AssemblyAI** streaming | Word-level timestamps for the timeline and filler-word analysis. |
| Interviewer LLM | **Claude Sonnet 5.5** (`claude-sonnet-5-5`) at low/medium effort | Fast enough for conversational turns; strong code reasoning so it can read the live editor state. |
| Text-to-speech | **ElevenLabs** or **Cartesia** | Natural voice; low time to first audio. |
| Feedback and grading | **Claude Opus 5.5** (`claude-opus-5-5`), structured outputs | Highest-quality analysis of a long code timeline plus transcript, run once per session where latency doesn't matter. |
| Research job | Claude with the web search tool, run weekly by a scheduled worker | Keeps company profiles current with cited sources. |
| Spaced repetition | **ts-fsrs** | Maintained, modern scheduler. |
| Deploy | Vercel (web), Fly.io or Railway (LiveKit agent worker, Judge0) | Simple to start; the voice and execution workers need long-lived processes. |

### Why a pipeline voice agent rather than speech-to-speech
Native speech-to-speech models (OpenAI's gpt-realtime family) have the lowest latency (roughly 300–500 ms) and a cost of about $0.02–0.05 per minute. A STT → LLM → TTS pipeline is slightly slower (about 500–800 ms) but gives us three things this product needs: a **timestamped transcript** of both sides for free, the ability to **inject live editor state** into every LLM turn with full control, and freedom to **swap any component**. We'll keep the agent behind an interface so a speech-to-speech provider can be tried later as an A/B option.

### Rough cost per 45-minute mock (estimate)
Voice transport, STT and TTS roughly $2–4; interviewer LLM turns $0.50–1.50 with prompt caching; one Opus feedback pass $0.30–0.80. **About $3–6 per mock**, which supports a subscription with a monthly mock quota.

## 6. Architecture

```
Browser (Next.js)
 ├─ Monaco editor ──(debounced diffs)──► API ──► session_events
 ├─ Run tests ───────────────────────► API ──► Judge0 ──► results ──► session_events
 └─ WebRTC audio ◄──────────────────► LiveKit room
                                           │
                               LiveKit Agent worker (interviewer)
                                 STT ─► Claude Sonnet 5.5 (+ latest code snapshot,
                                         problem, rubric, persona) ─► TTS
                                 transcript segments ─► session_events

Session end ─► feedback job (Claude Opus 5.5) ─► feedback_reports ─► roadmap update
Weekly cron ─► research job (Claude + web search) ─► company_profiles (review queue)
```

### Core data model
`users`, `goals` (target companies, date, hours) · `problems` (pattern tags, difficulty, tests) · `pattern_skill` (per user per pattern rating) · `attempts` (time, runs, hints, confidence, complexity correctness) · `review_cards` (FSRS state) · `mock_sessions` · `session_events` (type, ts, payload: diff, run, transcript) · `feedback_reports` · `company_profiles` (versioned, sourced).

## 7. Build plan

| Phase | Scope |
|---|---|
| **1. Practice core** | App skeleton, auth, problem bank (~150 problems over 18 patterns), Monaco plus Judge0 test runs, onboarding, roadmap with mastery gating and FSRS reviews. |
| **2. Live voice mock** | LiveKit interviewer with live code context, session recording and timeline. |
| **3. Feedback and new formats** | Feedback reports and timeline replay, AI-assisted coding round, code comprehension and debugging, weekly research job. |
| **4. Later** | System design, behavioral, code walkthrough, speech-to-speech A/B, mobile review mode. |

## 8. Success metrics
- Mocks completed per active user per week; review-card completion rate.
- Rubric score improvement across a user's first five mocks.
- Self-reported interview outcomes (offer rate) at 30 and 90 days.
- Interviewer quality: latency at the 95th percentile under 1.2 s per turn; rate of user "the interviewer was wrong" flags.

## 9. Risks
- **Voice latency and turn-taking** feel unnatural: tune endpointing, allow barge-in, stream TTS.
- **Grading accuracy:** build an eval set of recorded mocks with human-graded rubrics before shipping feedback widely.
- **Code execution security:** isolate Judge0, apply CVE patches, set resource limits.
- **Content licensing:** use original or paraphrased problems; link to public sources.
- **Stale data:** the research job's review queue and visible "last verified" dates on company profiles.

## Sources
- Meta AI-enabled coding round: https://www.amigohelp.ai/blog/meta-ai-enabled-coding-interview/
- Google AI-assisted coding interview: https://www.aced.io/blog/google-ai-coding-interview
- Companies allowing AI in interviews: https://www.finalroundai.com/blog/companies-that-allow-ai-during-interviews
- What changed in tech interviews in 2026: https://www.techinterview.org/post/3233475417/what-changed-tech-interviews-2026/
- AI mock interview platforms compared: https://prachub.com/resources/7-best-ai-mock-interview-platforms-in-2026-ranked-by-real-engineers
- Voice agent platforms compared: https://kanopylabs.com/blog/openai-realtime-api-vs-livekit-agents-vs-elevenlabs and https://www.assemblyai.com/blog/best-speech-to-speech-voice-agent-api
- OpenAI Realtime pricing: https://www.layer3labs.io/guides/openai-realtime-api-pricing
- Code execution engines: https://rustbox.sh/blog/rustbox-vs-judge0-vs-e2b-vs-piston-code-execution-engine
- FSRS: https://github.com/open-spaced-repetition/ts-fsrs
- Spacing and interleaving research: https://link.springer.com/article/10.1007/s10648-021-09613-w
