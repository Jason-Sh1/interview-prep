import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { PROBLEM_BY_SLUG } from "@/lib/problems";
import { PATTERN_BY_ID, PATTERNS } from "@/lib/problems/patterns";
import { complexityOptions, sampleTests, toPublic } from "@/lib/problems/public";
import { LANGUAGES, starterCode } from "@/lib/runner/drivers";
import { judge0Enabled } from "@/lib/runner/judge0";
import { getOpenDrills, getProblemHistory } from "@/lib/track";
import { pickVariant, variantFor } from "@/lib/variants";
import { variantProblem } from "@/lib/variants/shape";
import { Workspace, type WorkspaceMode } from "./Workspace";

export default async function ProblemPage({ params, searchParams }: PageProps<"/problems/[slug]">) {
  const { slug } = await params;
  const { mode: modeParam, variant: variantParam, original } = await searchParams;
  const base = PROBLEM_BY_SLUG.get(slug);
  if (!base) notFound();
  const { user, goals } = await requireOnboardedUser();
  const [history, drills] = await Promise.all([getProblemHistory(user.id, slug), getOpenDrills(user.id)]);
  const drill = drills.find((d) => d.problemSlug === slug) ?? null;

  const reviewDue = !!history.card && history.card.due <= new Date();
  const mode: WorkspaceMode =
    modeParam === "review" || modeParam === "mixed" || modeParam === "learn"
      ? modeParam
      : reviewDue
        ? "review"
        : "learn";
  const judge0 = judge0Enabled();

  // Reviews use a variant the user hasn't done yet, when one exists, so they
  // test the idea rather than memory of the old code. ?original=1 skips it.
  const requested = Number(variantParam);
  const variant =
    Number.isInteger(requested) && requested > 0
      ? ((await variantFor(slug, requested))?.variant ?? null)
      : // A re-solve from mock feedback (a card never reviewed) is meant to be the same problem.
        mode === "review" && original !== "1" && (history.card?.reps ?? 0) > 0
        ? await pickVariant(user.id, slug)
        : null;
  const problem = variant ? variantProblem(base, variant.data) : base;

  return (
    <Workspace
      key={`${slug}-${mode}-${variant?.id ?? "original"}`}
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
      drill={drill ? { title: drill.title, drill: drill.drill } : null}
      variant={variant ? { id: variant.id, twist: variant.data.twist, originalTitle: base.title } : null}
    />
  );
}
