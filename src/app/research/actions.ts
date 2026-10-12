"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { executeRun, reviewProfile, startRun } from "@/lib/research";
import { requireAdmin } from "@/lib/research/admin";

export async function startResearchAction(): Promise<{ error?: string }> {
  await requireAdmin();
  const run = await startRun("manual");
  if (!run) return { error: "A run is already going." };
  // Research takes minutes, so it finishes after the response.
  if (run.status === "running") after(() => executeRun(run.id));
  revalidatePath("/research");
  return {};
}

const reviewSchema = z.object({ id: z.coerce.number().int().positive(), decision: z.enum(["approved", "rejected"]) });

export async function reviewProfileAction(form: FormData) {
  const user = await requireAdmin();
  const { id, decision } = reviewSchema.parse({ id: form.get("id"), decision: form.get("decision") });
  await reviewProfile(id, decision, user.email);
  revalidatePath("/research");
  revalidatePath("/today");
  revalidatePath("/progress");
}
