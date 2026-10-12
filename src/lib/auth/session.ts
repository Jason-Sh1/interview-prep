import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  /** Verified by a sign-in provider (GitHub); email and password accounts aren't. */
  emailVerified: boolean;
}

/** The signed-in user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  return { id: s.user.id, name: s.user.name, email: s.user.email, emailVerified: s.user.emailVerified };
});

/** The signed-in user; redirects to sign-in otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/signin");
  return u;
}
