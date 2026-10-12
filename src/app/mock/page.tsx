import Link from "next/link";
import { DifficultyBadge, Tag } from "@/components/badges";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { COMPANIES, COMPANY_BY_ID } from "@/lib/engine/companies";
import { listMockSessions, mockCapabilities } from "@/lib/mock";
import { PROBLEM_BY_SLUG, problemsForPattern } from "@/lib/problems";
import { PATTERN_BY_ID, PATTERNS } from "@/lib/problems/patterns";
import { getTrackState } from "@/lib/track";
import { startMockAction } from "./actions";

export default async function MockSetupPage({ searchParams }: PageProps<"/mock">) {
  const { user, goals } = await requireOnboardedUser();
  const { problem: requested } = await searchParams;
  const [{ plan }, sessions] = await Promise.all([getTrackState(user.id, goals), listMockSessions(user.id)]);
  const caps = mockCapabilities();

  // Default to the problem the plan would give next, so a mock also moves the track along.
  const suggested =
    (typeof requested === "string" && PROBLEM_BY_SLUG.has(requested) && requested) ||
    plan.items.find((i) => i.kind === "new")?.slug ||
    plan.items[0]?.slug ||
    problemsForPattern("arrays-hashing")[0].slug;
  const suggestedProblem = PROBLEM_BY_SLUG.get(suggested)!;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Mock interview</h1>
      <p className="mt-1 text-muted">
        A live coding interview over voice. The interviewer sees your code as you type, asks questions, probes your complexity analysis and
        gives hints if you allow them. Everything is recorded for the feedback report.
      </p>

      <div className="card mt-6 space-y-1 p-4 text-sm">
        <p>
          <span className="font-medium">Voice:</span>{" "}
          {caps.voice === "livekit"
            ? "LiveKit voice pipeline (server speech-to-text and text-to-speech)."
            : "your browser's speech recognition and voice. Chrome or Edge work best; use headphones so the interviewer doesn't hear itself. You can also type."}
        </p>
        <p>
          <span className="font-medium">Interviewer:</span>{" "}
          {caps.interviewer === "claude"
            ? "Claude, reading your code live."
            : "scripted practice interviewer (set ANTHROPIC_API_KEY to use Claude). It follows the interview arc and reacts to your code and test runs with simple rules."}
        </p>
      </div>

      <form action={startMockAction} className="mt-8 space-y-6">
        <div>
          <label className="label" htmlFor="slug">Problem</label>
          <select className="input" id="slug" name="slug" defaultValue={suggested}>
            {PATTERNS.map((p) => (
              <optgroup key={p.id} label={p.name}>
                {problemsForPattern(p.id).map((q) => (
                  <option key={q.slug} value={q.slug}>
                    {q.title} ({q.difficulty})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Suggested from today&apos;s plan: {suggestedProblem.title}, {PATTERN_BY_ID[suggestedProblem.pattern].name}.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="minutes">Length</label>
            <select className="input" id="minutes" name="minutes" defaultValue="45">
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="persona">Interviewer</label>
            <select className="input" id="persona" name="persona" defaultValue="neutral">
              <option value="friendly">Friendly</option>
              <option value="neutral">Neutral</option>
              <option value="terse">Terse</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="company">Company style</label>
            <select className="input" id="company" name="company" defaultValue={goals.targetCompanies[0] ?? ""}>
              <option value="">Generic</option>
              {COMPANIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="language">Language</label>
            <select className="input" id="language" name="language" defaultValue={goals.language}>
              <option value="python">Python 3</option>
              <option value="javascript">JavaScript</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="hints" defaultChecked />
          Allow hints when I&apos;m stuck
        </label>
        <button className="btn-primary">Start the interview</button>
      </form>

      {sessions.length > 0 && (
        <>
          <h2 className="mt-12 text-lg font-semibold">Past interviews</h2>
          <ul className="mt-3 space-y-2">
            {sessions.map((s) => {
              const p = PROBLEM_BY_SLUG.get(s.problemSlug);
              return (
                <li key={s.id}>
                  <Link href={`/mock/${s.id}`} className="card flex flex-wrap items-center gap-2 p-3 text-sm hover:border-accent">
                    <span className="font-medium">{p?.title ?? s.problemSlug}</span>
                    {p && <DifficultyBadge difficulty={p.difficulty} />}
                    {s.config.company && <Tag>{COMPANY_BY_ID[s.config.company]?.name}</Tag>}
                    {!s.endedAt && <Tag tone="warn">Not finished</Tag>}
                    <span className="ml-auto text-muted">
                      {s.startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
