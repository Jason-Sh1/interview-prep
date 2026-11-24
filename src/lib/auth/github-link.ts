import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";

/**
 * Called after Better Auth stores a sign-in account. When a GitHub login is
 * linked to an existing email and password account (Settings → Link GitHub),
 * marks that account's email as verified, which admin pages need.
 *
 * Why this is safe: in better-auth 1.7.7, linking only succeeds when GitHub
 * reports the same email as the account's and says it's verified (GitHub is
 * not in `trustedProviders` and `allowDifferentEmails` is off; see
 * oauth2/link-account.mjs). Better Auth itself only sets `emailVerified` on a
 * later GitHub sign-in, so without this the documented "link, and your email
 * counts as verified" didn't happen.
 *
 * A GitHub sign-up has no password account, so it keeps whatever GitHub said.
 */
export async function verifyEmailOnGitHubLink(account: { userId: string; providerId: string }): Promise<boolean> {
  if (account.providerId !== "github") return false;
  const [password] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.userId, account.userId), eq(schema.account.providerId, "credential")))
    .limit(1);
  if (!password) return false;
  await db.update(schema.user).set({ emailVerified: true, updatedAt: new Date() }).where(eq(schema.user.id, account.userId));
  return true;
}
