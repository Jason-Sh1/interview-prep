"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { filesInputSchema } from "@/lib/assisted/types";
import { requireUser } from "@/lib/auth/session";
import { createDebugRound, finishDebugRound, generateDebugReport, getDebugRound } from "@/lib/comprehension";
import { DEBUG_TASK_BY_ID } from "@/lib/comprehension/tasks";

const startSchema = z.object({
  task: z.string().refine((t) => DEBUG_TASK_BY_ID.has(t), "Unknown task"),
  minutes: z.coerce.number().pipe(z.union([z.literal(30), z.literal(45)])),
  assistant: z.boolean(),
});

export async function startDebugAction(form: FormData) {
  const user = await requireUser();
  const p = startSchema.parse({ task: form.get("task"), minutes: form.get("minutes"), assistant: form.get("assistant") === "on" });
  const id = await createDebugRound(user.id, p.task, p.minutes, p.assistant);
  redirect(`/debug/${id}`);
}

const finishSchema = z.object({
  files: filesInputSchema,
  answers: z.record(z.string().max(100), z.string().max(5_000)),
  notes: z.string().max(10_000),
  tests: z.object({
    passed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    failing: z.array(z.string().max(300)).max(100),
    passing: z.array(z.string().max(300)).max(300),
  }),
});

export async function finishDebugAction(id: string, input: z.input<typeof finishSchema>) {
  const user = await requireUser();
  const round = await getDebugRound(id, user.id);
  if (!round) throw new Error("Unknown round");
  await finishDebugRound(round, finishSchema.parse(input));
}

export async function generateDebugReportAction(id: string): Promise<void> {
  const user = await requireUser();
  const round = await getDebugRound(id, user.id);
  if (!round) throw new Error("Unknown round");
  await generateDebugReport(round);
}
