"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { COMPANY_BY_ID } from "@/lib/engine/companies";
import { buildPlan, type PlanItem } from "@/lib/engine/planner";
import { PROBLEMS } from "@/lib/problems";
import { getGoals, getTrackState, recordAttempt, saveGoals, type AttemptResult } from "@/lib/track";

const goalsSchema = z.object({
  targetCompanies: z.array(z.string()).transform((xs) => xs.filter((x) => COMPANY_BY_ID[x])),
  level: z.enum(["new-grad", "mid", "senior", "staff"]),
  interviewDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  hoursPerWeek: z.coerce.number().int().min(1).max(60),
  language: z.enum(["python", "javascript"]),
});

/** Matches pasted LeetCode links or titles to problems in the bank. */
function matchImported(text: string): string[] {
  const lines = text
    .split(/[\n,]/)
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
  const found = new Set<string>();
  for (const p of PROBLEMS) {
    if (!p.source) continue;
    const lcSlug = p.source.url.match(/problems\/([^/]+)/)?.[1] ?? "";
    const lcTitle = p.source.name.replace(/^leetcode\s*\d+\.?\s*/i, "").toLowerCase();
    if (lines.some((l) => (lcSlug && l.includes(lcSlug)) || l === lcTitle || l.replace(/^\d+\.\s*/, "") === lcTitle)) {
      found.add(p.slug);
    }
  }
  return [...found];
}

export async function saveGoalsAction(form: FormData) {
  const user = await requireUser();
  const parsed = goalsSchema.parse({
    targetCompanies: form.getAll("companies").map(String),
    level: form.get("level"),
    interviewDate: form.get("interviewDate") || null,
    hoursPerWeek: form.get("hoursPerWeek"),
    language: form.get("language"),
  });
  const firstTime = !(await getGoals(user.id));
  await saveGoals(user.id, parsed);

  // Seed ratings from problems already solved elsewhere, so the track doesn't start from zero.
  const imported = matchImported(String(form.get("imported") ?? ""));
  if (imported.length) {
    const yesterday = new Date(Date.now() - 86_400_000);
    const state = await getTrackState(user.id, parsed);
    const solved = new Set(state.attempts.filter((a) => a.solved).map((a) => a.problemSlug));
    for (const slug of imported.filter((s) => !solved.has(s))) {
      await recordAttempt(
        user.id,
        {
          slug,
          mode: "learn",
          language: parsed.language,
          solved: true,
          gaveUp: false,
          startedAt: yesterday.toISOString(),
          secondsToFirstRun: null,
          secondsToAccepted: null,
          runCount: 0,
          failedRuns: 0,
          failingLabels: [],
          hintsUsed: 0,
          confidence: 3,
          complexityChoice: null,
          code: null,
        },
        yesterday,
      );
    }
  }
  redirect(firstTime || imported.length ? "/today?welcome=1" : "/today");
}

const attemptSchema = z.object({
  slug: z.string(),
  mode: z.enum(["learn", "review", "mixed"]),
  language: z.enum(["python", "javascript"]),
  solved: z.boolean(),
  gaveUp: z.boolean(),
  startedAt: z.string(),
  secondsToFirstRun: z.number().int().nonnegative().nullable(),
  secondsToAccepted: z.number().int().nonnegative().nullable(),
  runCount: z.number().int().nonnegative(),
  failedRuns: z.number().int().nonnegative(),
  failingLabels: z.array(z.string()),
  hintsUsed: z.number().int().min(0).max(3),
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
  complexityChoice: z.string().nullable(),
  code: z.string().nullable(),
});

export async function recordAttemptAction(
  input: z.input<typeof attemptSchema>,
): Promise<{ result: AttemptResult; next: PlanItem | null }> {
  const user = await requireUser();
  const result = await recordAttempt(user.id, attemptSchema.parse(input));
  const goals = await getGoals(user.id);
  let next: PlanItem | null = null;
  if (goals) {
    const s = await getTrackState(user.id, goals);
    next = buildPlan({ now: new Date(), goals, skills: s.skills, attempts: s.attempts, cards: s.cards, problems: PROBLEMS }).items[0] ?? null;
  }
  return { result, next };
}
