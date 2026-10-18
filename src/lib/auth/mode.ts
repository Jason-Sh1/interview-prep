// AUTH_MODE picks how people get in:
// - "single": no sign-up or sign-in. Everyone who opens the app is the one
//   built-in local user, who can also review research. For running it on your
//   own machine.
// - "accounts": email and password (plus optional GitHub) through Better Auth.
//   Use this for anything reachable from the internet.
// Unset, it's "single", except on Vercel, where it's "accounts" so a hosted
// deploy is never left open.

export type AuthMode = "single" | "accounts";

export function authMode(): AuthMode {
  const v = process.env.AUTH_MODE?.trim().toLowerCase();
  if (v === "single" || v === "accounts") return v;
  return process.env.VERCEL ? "accounts" : "single";
}

export const isSingleUser = () => authMode() === "single";

export const LOCAL_USER = {
  id: "local-user",
  name: "Me",
  email: "me@localhost",
  emailVerified: true,
} as const;
