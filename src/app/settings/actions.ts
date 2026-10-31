"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSingleUser } from "@/lib/auth/mode";
import { requireUser } from "@/lib/auth/session";
import { deleteAllUserData, purgeRecordings, setRecordingConsent } from "@/lib/privacy";

export async function setConsentAction(form: FormData) {
  const user = await requireUser();
  await setRecordingConsent(user.id, form.get("consent") === "on");
  revalidatePath("/settings");
}

export async function deleteRecordingsAction() {
  const user = await requireUser();
  await purgeRecordings({ userId: user.id });
  redirect("/settings?deleted=recordings");
}

/** Deletes the account and every row that belongs to it. Needs the word "delete" typed in. */
export async function deleteAllDataAction(form: FormData) {
  const user = await requireUser();
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== "delete") redirect("/settings?confirm=1");
  await deleteAllUserData(user);
  // The session row is gone with the user, so the cookie no longer signs anyone in.
  redirect(isSingleUser() ? "/onboarding?deleted=1" : "/?deleted=1");
}
