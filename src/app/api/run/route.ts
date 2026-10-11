import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { PROBLEM_BY_SLUG } from "@/lib/problems";
import { judge0Enabled, runOnJudge0 } from "@/lib/runner/judge0";

const body = z.object({
  slug: z.string(),
  language: z.enum(["python", "javascript"]),
  code: z.string().max(100_000),
  scope: z.enum(["sample", "all"]),
});

/** Runs code on Judge0. Only used when JUDGE0_URL is set; otherwise code runs in the browser. */
export async function POST(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!judge0Enabled()) return NextResponse.json({ error: "Judge0 is not configured" }, { status: 404 });
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { slug, language, code, scope } = parsed.data;
  const problem = PROBLEM_BY_SLUG.get(slug);
  if (!problem) return NextResponse.json({ error: "Unknown problem" }, { status: 404 });
  const tests = scope === "sample" ? problem.tests.filter((t) => t.sample) : problem.tests;
  const outcome = await runOnJudge0(problem.signature, language, code, tests);
  // Don't reveal hidden test inputs: only the first failing hidden test is shown, as in a real judge.
  if (scope === "all") {
    const firstHiddenFail = outcome.results.find((r) => !r.passed && !r.sample);
    outcome.results = outcome.results.filter((r) => r.sample || r === firstHiddenFail);
  }
  return NextResponse.json(outcome);
}
