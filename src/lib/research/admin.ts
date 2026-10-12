import "server-only";
import { notFound } from "next/navigation";
import { requireUser, type CurrentUser } from "../auth/session";

// Who may review research: the emails in ADMIN_EMAILS (comma-separated),
// signed in with a provider that verified the address (GitHub), since anyone
// can register an unverified email. With it unset, anyone signed in during
// local development, and nobody in production.

export function isAdmin(user: Pick<CurrentUser, "email" | "emailVerified">): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return process.env.NODE_ENV !== "production";
  return user.emailVerified && list.includes(user.email.toLowerCase());
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  return user;
}
