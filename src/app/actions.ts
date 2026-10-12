"use server";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { COMPANY_BY_ID } from "@/lib/engine/companies";
import { isValidTimeZone } from "@/lib/engine/day";
import type { PlanItem } from "@/lib/engine/planner";
import { matchImported } from "@/lib/problems/import";
import { getGoals, getTrackState, recordAttempt, saveGoals, type AttemptResult } from "@/lib/track";
import { ensureVariant } from "@/lib/variants";

const goalsSchema = z.object({
  targetCompanies: z.array(z.string()).transform((xs) => xs.filter((x) => COMPANY_BY_ID[x])),
  level: z.enum(["new-grad", "mid", "senior", "staff"]),
  interviewDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  hoursPerWeek: z.coerce.number().int().min(1).max(60),
  language: z.enum(["python", "javascript"]),
  timeZone: z
    .string()
    .max(64)
    .nullable()
    .transform((tz) => (tz && isValidTimeZone(tz) ? tz : null)),
});

export async function saveGoalsAction(form: FormData) {
  const user = await requireUser();
  const parsed = goalsSchema.parse({
    targetCompanies: form.getAll("companies").map(String),
    level: form.get("level"),
    interviewDate: form.get("interviewDate") || null,
    hoursPerWeek: form.get("hoursPerWeek"),
    language: form.get("language"),
    timeZone: form.get("timeZone") || null,
  });
  const existing = await getGoals(user.id);
  const firstTime = !existing;
  // The zone field fills in after hydration; an early submit shouldn't wipe a known zone.
  if (!parsed.timeZone && existing?.timeZone) parsed.timeZone = existing.timeZone;
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
  // New users get the diagnostic first (spec 4.1), after any import so it can avoid problems they've solved.
  if (firstTime) redirect("/diagnostic");
  redirect(imported.length ? "/today?welcome=1" : "/today");
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
  variantId: z.number().int().positive().nullable().optional(),
  /** The browser's zone; it keeps goals.timeZone current for users who set goals before it was recorded. */
  timeZone: z.string().max(64).optional(),
});

export async function recordAttemptAction(
  input: z.input<typeof attemptSchema>,
): Promise<{ result: AttemptResult; next: PlanItem | null }> {
  const user = await requireUser();
  const { timeZone, ...attempt } = attemptSchema.parse(input);
  const result = await recordAttempt(user.id, attempt);
  // Get a fresh variant ready for this problem's next review (spec 4.2).
  if (result.solved) after(() => ensureVariant(user.id, attempt.slug).catch((e) => console.error("Variant generation failed", e)));
  let goals = await getGoals(user.id);
  let next: PlanItem | null = null;
  if (goals && timeZone && timeZone !== goals.timeZone && isValidTimeZone(timeZone)) {
    goals = { ...goals, timeZone };
    await saveGoals(user.id, goals);
  }
  if (goals) {
    next = (await getTrackState(user.id, goals)).plan.items[0] ?? null;
  }
  return { result, next };
}
