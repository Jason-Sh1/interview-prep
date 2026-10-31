"use server";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/require-goals";
import { setRecordingConsent } from "@/lib/privacy";
import { finishDiagnostic, skipDiagnostic, startDiagnostic, startDiagnosticMock } from "@/lib/diagnostic";

export async function startDiagnosticAction() {
  const { user } = await requireOnboardedUser();
  await startDiagnostic(user.id);
  redirect("/diagnostic");
}

export async function startDiagnosticMockAction(form: FormData) {
  const { user, goals } = await requireOnboardedUser();
  if (form.get("consent") === "on") await setRecordingConsent(user.id, true);
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
