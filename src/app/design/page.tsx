import { Tag } from "@/components/badges";
import { RecordingConsent } from "@/components/RecordingConsent";
import { PastRounds } from "@/components/rounds/PastRounds";
import { RoundSetup } from "@/components/rounds/RoundSetup";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { DESIGN_TOPIC_BY_ID, DESIGN_TOPICS } from "@/lib/design/topics";
import { claudeEnabled } from "@/lib/interview/claude";
import { getPrivacy } from "@/lib/privacy";
import { listRounds } from "@/lib/rounds";

const LEVEL_LABEL = { any: "Any level", mid: "Mid-level+", senior: "Senior+" } as const;
const LEVEL_ORDER: Record<string, number> = { "new-grad": 0, mid: 1, senior: 2, staff: 3 };

export default async function DesignPage() {
  const { user, goals } = await requireOnboardedUser();
  const [rounds, privacy] = await Promise.all([listRounds(user.id, "design"), getPrivacy(user.id)]);
  const done = new Set(rounds.filter((r) => r.endedAt).map((r) => r.topicId));
  const lvl = LEVEL_ORDER[goals.level] ?? 1;
  // Prompts at your level first, then ones you haven't done.
  const topics = [...DESIGN_TOPICS].sort(
    (a, b) =>
      Number((LEVEL_ORDER[a.level] ?? 0) > lvl) - Number((LEVEL_ORDER[b.level] ?? 0) > lvl) || Number(done.has(a.id)) - Number(done.has(b.id)),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">System design</h1>
      <p className="mt-1 text-muted">
        Most loops from mid-level up include a design round: an open-ended prompt, a whiteboard, and an interviewer who pushes on requirements, scale and
        trade-offs.{goals.level === "new-grad" ? " New-grad loops rarely have one, but it's good practice if yours does." : ""}
      </p>

      <div className="card mt-6 space-y-1 p-4 text-sm">
        <p>
          <span className="font-medium">How it works:</span> draw on the whiteboard and talk (or type) through your design. The interviewer can see the
          board, answers clarifying questions, moves you through requirements, estimates, API, high-level design, deep dives and failure handling, and
          wraps up near the end. Afterwards you get a report against a typical design rubric.
        </p>
        <p>
          <span className="font-medium">Interviewer:</span>{" "}
          {claudeEnabled() ? "Claude, reading your whiteboard as you draw." : "a scripted interviewer that follows the same arc (set ANTHROPIC_API_KEY to use Claude)."} Voice works in
          Chrome and Edge; use headphones.
        </p>
      </div>

      {!privacy.recordingConsent && (
        <div className="mt-6">
          <RecordingConsent claude={claudeEnabled()} livekit={false} checkbox={false} what="design round" />
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold">Pick a prompt</h2>
      <ul className="mt-3 space-y-3">
        {topics.map((t) => (
          <li key={t.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t.title}</span>
              <Tag>{LEVEL_LABEL[t.level]}</Tag>
              {done.has(t.id) && <Tag tone="good">Done</Tag>}
            </div>
            <p className="mt-1 text-sm">{t.summary}</p>
            <p className="mt-1 text-xs text-muted">Asked at: {t.companies.join(", ")}</p>
            <RoundSetup kind="design" topic={t.id} targets={goals.targetCompanies} needsConsent={!privacy.recordingConsent} />
          </li>
        ))}
      </ul>

      <PastRounds rounds={rounds} titleOf={(r) => DESIGN_TOPIC_BY_ID.get(r.topicId)?.title ?? "System design"} />
    </main>
  );
}
