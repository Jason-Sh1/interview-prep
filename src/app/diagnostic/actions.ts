"use server";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { finishDiagnostic, skipDiagnostic, startDiagnostic, startDiagnosticMock } from "@/lib/diagnostic";

export async function startDiagnosticAction() {
  const { user } = await requireOnboardedUser();
  await startDiagnostic(user.id);
  redirect("/diagnostic");
}

export async function startDiagnosticMockAction() {
  const { user, goals } = await requireOnboardedUser();
  const id = await startDiagnosticMock(user.id, goals.language);
  redirect(`/mock/${id}`);
}

export async function finishDiagnosticAction() {
  const { user } = await requireOnboardedUser();
  await finishDiagnostic(user.id);
  redirect("/diagnostic");
}

export async function skipDiagnosticAction() {
  const { user } = await requireOnboardedUser();
  await skipDiagnostic(user.id);
  redirect("/today?welcome=1");
}
