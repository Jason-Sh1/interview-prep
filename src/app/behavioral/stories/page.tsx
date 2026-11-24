import Link from "next/link";
import { Tag } from "@/components/badges";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { COMPETENCY_BY_ID } from "@/lib/behavioral/competencies";
import { coverageMatrix } from "@/lib/behavioral/coverage";
import { COMPANY_PRINCIPLES, principlesFor } from "@/lib/behavioral/principles";
import { getResume, listStories } from "@/lib/behavioral/stories";
import { COMPANIES, COMPANY_BY_ID } from "@/lib/engine/companies";
import { claudeEnabled } from "@/lib/interview/claude";
import { ResumeForm } from "./ResumeForm";
import { StoryBank } from "./StoryBank";

export default async function StoriesPage({ searchParams }: PageProps<"/behavioral/stories">) {
  const { user, goals } = await requireOnboardedUser();
  const sp = await searchParams;
  const asked = typeof sp.company === "string" ? sp.company : undefined;
  const company = asked === "none" ? null : asked && COMPANY_PRINCIPLES[asked] ? asked : (goals.targetCompanies.find((c) => COMPANY_PRINCIPLES[c]) ?? null);
  const editId = typeof sp.edit === "string" ? Number(sp.edit) || null : null;
  const [resume, stories] = await Promise.all([getResume(user.id), listStories(user.id)]);
  const cov = coverageMatrix(stories, company);
  const cp = principlesFor(company);
  const title = new Map(stories.map((s) => [s.id, s.title]));
  const rows: { id: string; label: string; stories: number[]; help: string }[] = cp
    ? cov.principles.map((r) => ({ ...r, help: `${r.principle.summary} Shown by: ${r.principle.competencies.map((c) => COMPETENCY_BY_ID.get(c)?.label ?? c).join(", ")}.` }))
    : cov.competencies.map((r) => ({ ...r, help: COMPETENCY_BY_ID.get(r.id)?.help ?? "" }));
  const compGaps = cov.competencies.filter((r) => !r.stories.length).map((r) => r.label);
  const companies = [...COMPANIES].sort((a, b) => Number(goals.targetCompanies.includes(b.id)) - Number(goals.targetCompanies.includes(a.id)));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <p className="text-sm">
        <Link href="/behavioral" className="text-accent hover:underline">
          ← Behavioral
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-semibold">Story bank</h1>
      <p className="mt-1 text-muted">
        Six to ten good stories cover most behavioral loops: each one told in STAR order (situation, task, action, result), in the first person, with a
        number in the result. Interviewers see their titles and summaries during a round and may ask about them.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Resume</h2>
      <ResumeForm initialText={resume?.text ?? ""} fileName={resume?.fileName ?? null} usesClaude={claudeEnabled()} />

      <h2 className="mt-8 text-lg font-semibold">Stories</h2>
      <StoryBank
        stories={stories.map((s) => ({ id: s.id, title: s.title, situation: s.situation, task: s.task, action: s.action, result: s.result, competencies: s.competencies, origin: s.origin }))}
        editId={editId}
      />

      <h2 className="mt-10 text-lg font-semibold">Coverage</h2>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-muted">Check against:</span>
        <Link href="/behavioral/stories?company=none" className={`rounded px-2 py-0.5 ${!company ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}>
          Competencies
        </Link>
        {companies
          .filter((c) => COMPANY_PRINCIPLES[c.id])
          .map((c) => (
            <Link
              key={c.id}
              href={`/behavioral/stories?company=${c.id}`}
              className={`rounded px-2 py-0.5 ${company === c.id ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}
            >
              {c.name}
            </Link>
          ))}
      </div>
      <div className="card mt-3 p-4 text-sm">
        {cp && (
          <p className="mb-2 text-muted">
            {COMPANY_BY_ID[cp.company]?.name}&apos;s {cp.label}, and which of your stories show them (through the competencies they&apos;re tagged with).
          </p>
        )}
        <table className="w-full text-left">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 pr-3 font-medium">{cp ? "Principle" : "Competency"}</th>
              <th className="py-1 font-medium">Stories</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="py-1.5 pr-3">
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-muted">{r.help}</div>
                </td>
                <td className="py-1.5">
                  {r.stories.length ? (
                    <div className="flex flex-wrap gap-1">
                      {r.stories.map((id) => (
                        <Tag key={id} tone={r.stories.length === 1 ? "warn" : "good"}>
                          {title.get(id)}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <Tag tone="bad">Gap</Tag>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stories.length > 0 && (
        <div className="mt-3 space-y-1 text-sm">
          {cov.gaps.length > 0 && (
            <p>
              <span className="font-medium">Gaps: </span>
              {cov.gaps.join(", ")}. Write or tag a story for each.
            </p>
          )}
          {cp && compGaps.length > 0 && <p className="text-muted">Competencies with no story: {compGaps.join(", ")}.</p>}
          {cov.thin.length > 0 && <p className="text-muted">Only one story for: {cov.thin.join(", ")}. A second helps when an interviewer asks twice.</p>}
          {!cov.gaps.length && <p className="text-good">Every row has at least one story.</p>}
        </div>
      )}
    </main>
  );
}
