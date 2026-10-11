import "server-only";
import { redirect } from "next/navigation";
import { getGoals, type Goals } from "../track";
import { requireUser, type CurrentUser } from "./session";

/** The signed-in user with goals set; sends new users to onboarding. */
export async function requireOnboardedUser(): Promise<{ user: CurrentUser; goals: Goals }> {
  const user = await requireUser();
  const goals = await getGoals(user.id);
  if (!goals) redirect("/onboarding");
  return { user, goals };
}
