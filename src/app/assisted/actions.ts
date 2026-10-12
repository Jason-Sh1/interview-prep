"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createAssistedSession, finishAssisted, generateAssistedReport, getAssistedSession } from "@/lib/assisted";
import { TASK_BY_ID } from "@/lib/assisted/tasks";
import { filesInputSchema } from "@/lib/assisted/types";

const startSchema = z.object({
  task: z.string().refine((t) => TASK_BY_ID.has(t), "Unknown task"),
  minutes: z.coerce.number().pipe(z.union([z.literal(45), z.literal(60)])),
});

export async function startAssistedAction(form: FormData) {
  const user = await requireUser();
  const p = startSchema.parse({ task: form.get("task"), minutes: form.get("minutes") });
  const id = await createAssistedSession(user.id, p.task, p.minutes);
  redirect(`/assisted/${id}`);
}

const finishSchema = z.object({
  files: filesInputSchema,
  explanation: z.string().max(10_000),
  tests: z.object({
    passed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    failing: z.array(z.string().max(300)).max(100),
  }),
});

export async function finishAssistedAction(id: string, input: z.input<typeof finishSchema>) {
  const user = await requireUser();
  const session = await getAssistedSession(id, user.id);
  if (!session) throw new Error("Unknown session");
  await finishAssisted(session, finishSchema.parse(input));
}

export async function generateAssistedReportAction(id: string): Promise<void> {
  const user = await requireUser();
  const session = await getAssistedSession(id, user.id);
  if (!session) throw new Error("Unknown session");
  await generateAssistedReport(session);
}
