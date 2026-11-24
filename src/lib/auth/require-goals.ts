import "server-only";
import { redirect } from "next/navigation";
import { scheduleRetentionPurge } from "../retention-schedule";
import { getGoals, type Goals } from "../track";
import { requireUser, type CurrentUser } from "./session";

/** The signed-in user with goals set; sends new users to onboarding. */
export async function requireOnboardedUser(): Promise<{ user: CurrentUser; goals: Goals }> {
  const user = await requireUser();
  // Deletes expired recordings at most once a day, after this response (see retention-schedule.ts).
  scheduleRetentionPurge();
  const goals = await getGoals(user.id);
  if (!goals) redirect("/onboarding");
  return { user, goals };
}
