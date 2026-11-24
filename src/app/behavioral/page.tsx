import Link from "next/link";
import { Tag } from "@/components/badges";
import { PastRounds } from "@/components/rounds/PastRounds";
import { RoundSetup } from "@/components/rounds/RoundSetup";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { coverageMatrix } from "@/lib/behavioral/coverage";
import { BEHAVIORAL_LENGTHS, BEHAVIORAL_TOPIC_BY_ID, BEHAVIORAL_TOPICS, questionCount } from "@/lib/behavioral/questions";
import { listStories } from "@/lib/behavioral/stories";
import { COMPANY_BY_ID } from "@/lib/engine/companies";
import { claudeEnabled } from "@/lib/interview/claude";
import { listRounds } from "@/lib/rounds";
import { startBehavioralRoundAction } from "./actions";

const LEVEL_LABEL = { any: "Any level", "new-grad": "New grad", senior: "Senior+" } as const;

export default async function BehavioralPage() {
  const { user, goals } = await requireOnboardedUser();
  const [rounds, stories] = await Promise.all([listRounds(user.id, "behavioral"), listStories(user.id)]);
  const done = new Set(rounds.filter((r) => r.endedAt).map((r) => r.topicId));
  const target = goals.targetCompanies[0] ?? null;
  const cov = coverageMatrix(stories, target);
  // Sets for your level and target companies first, then ones you haven't done.
  const rank = (t: (typeof BEHAVIORAL_TOPICS)[number]) =>
    (t.company && goals.targetCompanies.includes(t.company) ? -2 : 0) +
    (t.level === "any" || t.level === goals.level || (t.level === "senior" && goals.level === "staff") ? 0 : 1) +
    (done.has(t.id) ? 1 : 0);
  const topics = [...BEHAVIORAL_TOPICS].sort((a, b) => rank(a) - rank(b));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Behavioral</h1>
      <p className="mt-1 text-muted">
        Almost every loop has a behavioral round, and at Amazon it runs through every interview. You tell real stories; the interviewer listens for
        structure, what you personally did, the result, and what you learned.
      </p>

      <div className="card mt-6 space-y-2 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium">Your story bank:</span>
          <span>
            {stories.length ? `${stories.length} ${stories.length === 1 ? "story" : "stories"}` : "empty"}
            {stories.length > 0 && cov.gaps.length > 0 && (
              <span className="text-muted">
                {" "}
                · gaps{target && COMPANY_BY_ID[target] ? ` for ${COMPANY_BY_ID[target].name}` : ""}: {cov.gaps.slice(0, 4).join(", ")}
                {cov.gaps.length > 4 ? "…" : ""}
              </span>
            )}
          </span>
          <Link href="/behavioral/stories" className="btn-secondary ml-auto">
            {stories.length ? "Open story bank" : "Build it from your resume"}
          </Link>
        </div>
        <p>
          <span className="font-medium">How it works:</span> the interviewer asks a set of questions in order and follows up on each answer when the
          situation, your own actions, the result or the lesson is missing, then asks if you have questions. Afterwards you get STAR checks per answer,
          the principles you showed, and a report.
        </p>
        <p>
          <span className="font-medium">Interviewer:</span>{" "}
          {claudeEnabled() ? "Claude, with your story titles and summaries in view." : "a scripted interviewer with STAR checks (set ANTHROPIC_API_KEY to use Claude)."} Voice
          works in Chrome and Edge; typing always works.
        </p>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Pick a question set</h2>
      <p className="mt-1 text-sm text-muted">
        {BEHAVIORAL_LENGTHS.map((m) => `${m} minutes: ${questionCount(m)} questions`).join(" · ")}, with follow-ups.
      </p>
      <ul className="mt-3 space-y-3">
        {topics.map((t) => (
          <li key={t.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t.title}</span>
              <Tag>{LEVEL_LABEL[t.level]}</Tag>
              {done.has(t.id) && <Tag tone="good">Done</Tag>}
            </div>
            <p className="mt-1 text-sm">{t.summary}</p>
            <RoundSetup
              kind="behavioral"
              topic={t.id}
              targets={t.company ? [t.company] : goals.targetCompanies}
              minutes={[...BEHAVIORAL_LENGTHS]}
              defaultMinutes={30}
              action={startBehavioralRoundAction}
            />
          </li>
        ))}
      </ul>

      <PastRounds rounds={rounds} titleOf={(r) => BEHAVIORAL_TOPIC_BY_ID.get(r.topicId)?.title ?? "Behavioral"} />
    </main>
  );
}
