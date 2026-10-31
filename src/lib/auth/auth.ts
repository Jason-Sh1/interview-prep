import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "../db";
import { INVITE_HEADER, inviteCode, inviteOk } from "./invite";

const invite = inviteCode();

const github =
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        // GitHub sign-in can't carry an invite code, so with one set it only signs in existing accounts.
        disableSignUp: !!invite,
      }
    : undefined;

export const githubEnabled = !!github;
export const inviteRequired = !!invite;

export const auth = betterAuth({
  appName: "Interview Prep",
  // BETTER_AUTH_URL wins; on Vercel, fall back to the production domain.
  baseURL:
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  socialProviders: github ? { github } : {},
  // On in production. Stored in Postgres so the limits hold across serverless
  // instances; sign-in and sign-up get tighter limits against password guessing.
  rateLimit: {
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 10 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && !inviteOk(ctx.headers?.get(INVITE_HEADER), invite)) {
        throw new APIError("FORBIDDEN", { message: "That invite code isn't right. Ask whoever runs this site for one." });
      }
    }),
  },
  plugins: [nextCookies()],
});
