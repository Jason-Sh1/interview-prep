import "server-only";
import { notFound } from "next/navigation";
import { requireUser, type CurrentUser } from "../auth/session";

// Who may review research: the emails in ADMIN_EMAILS (comma-separated). With
// it unset, anyone signed in during local development, and nobody in production.

export function isAdmin(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return process.env.NODE_ENV !== "production";
  return list.includes(email.toLowerCase());
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdmin(user.email)) notFound();
  return user;
}
