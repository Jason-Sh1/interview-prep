import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { PROBLEM_BY_SLUG } from "@/lib/problems";
import { PATTERN_BY_ID, PATTERNS } from "@/lib/problems/patterns";
import { complexityOptions, sampleTests, toPublic } from "@/lib/problems/public";
import { LANGUAGES, starterCode } from "@/lib/runner/drivers";
import { judge0Enabled } from "@/lib/runner/judge0";
import { getProblemHistory } from "@/lib/track";
import { Workspace, type WorkspaceMode } from "./Workspace";

export default async function ProblemPage({ params, searchParams }: PageProps<"/problems/[slug]">) {
  const { slug } = await params;
  const { mode: modeParam } = await searchParams;
  const problem = PROBLEM_BY_SLUG.get(slug);
  if (!problem) notFound();
  const { user, goals } = await requireOnboardedUser();
  const history = await getProblemHistory(user.id, slug);

  const reviewDue = !!history.card && history.card.due <= new Date();
  const mode: WorkspaceMode =
    modeParam === "review" || modeParam === "mixed" || modeParam === "learn"
      ? modeParam
      : reviewDue
        ? "review"
        : "learn";
  const judge0 = judge0Enabled();

  return (
    <Workspace
      key={`${slug}-${mode}`}
      problem={toPublic(problem)}
      patternName={PATTERN_BY_ID[problem.pattern].name}
      patternChoices={PATTERNS.map((p) => ({ id: p.id, name: p.name }))}
      mode={mode}
      samples={sampleTests(problem)}
      // In browser mode every test has to reach the browser to run there.
      allTests={judge0 ? null : problem.tests}
      runner={judge0 ? "judge0" : "browser"}
      starters={Object.fromEntries(LANGUAGES.map((l) => [l.id, starterCode(problem.signature, l.id)])) as Record<"python" | "javascript", string>}
      defaultLanguage={goals.language}
      complexityChoices={complexityOptions(problem)}
      previousAttempts={history.attempts.length}
      solvedBefore={history.attempts.some((a) => a.solved)}
    />
  );
}
