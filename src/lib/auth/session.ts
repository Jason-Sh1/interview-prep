import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { cache } from "react";
import { db, ensureMigrated, schema } from "../db";
import { auth } from "./auth";
import { isSingleUser, LOCAL_USER } from "./mode";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  /** Verified by a sign-in provider (GitHub); email and password accounts aren't. */
  emailVerified: boolean;
}

// Single-user mode's user: the first account already in the database, so
// progress made before this mode existed carries over, or else a built-in one,
// created once per process because every progress table references user.id.
const g = globalThis as unknown as { __ipLocalUser?: Promise<CurrentUser> };
function localUser(): Promise<CurrentUser> {
  return (g.__ipLocalUser ??= (async () => {
    await ensureMigrated();
    const [first] = await db.select().from(schema.user).orderBy(asc(schema.user.createdAt)).limit(1);
    if (first) return { id: first.id, name: first.name, email: first.email, emailVerified: first.emailVerified };
    await db.insert(schema.user).values(LOCAL_USER).onConflictDoNothing();
    return { ...LOCAL_USER };
  })().catch((e) => {
    g.__ipLocalUser = undefined;
    throw e;
  }));
}

/** The signed-in user (in single-user mode, the built-in one), or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (isSingleUser()) {
    return localUser();
  }
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
