import { timingSafeEqual } from "node:crypto";

// An optional invite code for sign-up (SIGNUP_INVITE_CODE). A hosted app with
// open sign-up lets anyone spend the owner's API budget; with a code set, only
// people who were given it can create an account. Existing accounts can always
// sign in.

export { INVITE_HEADER } from "./invite-header";

export const inviteCode = (env: Record<string, string | undefined> = process.env) => env.SIGNUP_INVITE_CODE?.trim() || null;

/** Whether `given` matches the configured code; true when no code is set. */
export function inviteOk(given: string | null | undefined, expected: string | null = inviteCode()): boolean {
  if (!expected) return true;
  const a = Buffer.from(given?.trim() ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
