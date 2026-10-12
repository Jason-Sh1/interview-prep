import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { isDiagnosticMock } from "@/lib/diagnostic";
import { COMPANY_BY_ID } from "@/lib/engine/companies";
import { getReport } from "@/lib/feedback";
import { claudeEnabled } from "@/lib/interview/claude";
import { codeAt, interviewStartT, transcript } from "@/lib/interview/timeline";
import { getEvents, getMockSession, sessionClock } from "@/lib/mock";
import { PROBLEM_BY_SLUG } from "@/lib/problems";
import { PATTERN_BY_ID } from "@/lib/problems/patterns";
import { sampleTests, toPublic } from "@/lib/problems/public";
import { LANGUAGES, starterCode, type Language } from "@/lib/runner/drivers";
import { judge0Enabled } from "@/lib/runner/judge0";
import { MockRoom } from "./MockRoom";
import { Recap } from "./Recap";

export default async function MockSessionPage({ params }: PageProps<"/mock/[id]">) {
  const { id } = await params;
  const { user } = await requireOnboardedUser();
  const session = await getMockSession(id, user.id);
  if (!session) notFound();
  const problem = PROBLEM_BY_SLUG.get(session.problemSlug);
  if (!problem) notFound();
  const events = await getEvents(id);
  const companyName = session.config.company ? (COMPANY_BY_ID[session.config.company]?.name ?? null) : null;

  if (session.endedAt) {
    const [report, diagnostic] = await Promise.all([getReport(id), isDiagnosticMock(user.id, id)]);
    return (
      <Recap
        sessionId={id}
        report={report ? { report: report.report, trackChanges: report.trackChanges } : null}
        usesClaude={claudeEnabled()}
        title={problem.title}
        patternName={PATTERN_BY_ID[problem.pattern].name}
        difficulty={problem.difficulty}
        optimal={problem.complexity}
        companyName={companyName}
        config={session.config}
        voice={session.voice}
        interviewer={session.interviewer}
        startedAt={session.startedAt.toISOString()}
        durationMs={session.endedAt.getTime() - session.startedAt.getTime()}
        events={events}
        diagnostic={diagnostic}
      />
    );
  }

  const judge0 = judge0Enabled();
  const resumed = codeAt(events);
  const language = (resumed.language ?? session.language) as Language;
  return (
    <MockRoom
      key={id}
      sessionId={id}
      problem={toPublic(problem)}
      patternName={PATTERN_BY_ID[problem.pattern].name}
      companyName={companyName}
      samples={sampleTests(problem)}
      allTests={judge0 ? null : problem.tests}
      runner={judge0 ? "judge0" : "browser"}
      starters={Object.fromEntries(LANGUAGES.map((l) => [l.id, starterCode(problem.signature, l.id)])) as Record<Language, string>}
      initialLanguage={language}
      initialCode={resumed.language ? resumed.code : null}
      initialLines={transcript(events)}
      config={session.config}
      voice={session.voice}
      interviewer={session.interviewer}
      elapsedAtRender={sessionClock(session)}
      startT={interviewStartT(events)}
    />
  );
}
