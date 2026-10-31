import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The hosted path: AUTH_MODE=accounts with Better Auth, against an embedded
// database. next/headers is stubbed so getCurrentUser sees the cookie a real
// browser would send back.
let requestHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, has: () => false }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));

const saved = { ...process.env };
beforeAll(() => {
  process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "accounts-db-"));
  process.env.AUTH_MODE = "accounts";
  process.env.SIGNUP_INVITE_CODE = "club-2026";
  process.env.BETTER_AUTH_SECRET = "test-secret-that-is-long-enough-1234567890";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  delete process.env.ANTHROPIC_API_KEY;
  vi.resetModules();
});
// The app applies migrations at startup (instrumentation.ts); do the same here.
beforeAll(async () => {
  await (await import("@/lib/db")).ensureMigrated();
}, 120_000);
afterAll(() => {
  process.env = saved;
});

/** Signs up through Better Auth's API and returns the cookie header a browser would send. */
async function signUp(email: string, invite: string | null): Promise<string> {
  const { auth } = await import("@/lib/auth/auth");
  const headers = new Headers({ origin: "http://localhost:3000" });
  if (invite !== null) headers.set("x-invite-code", invite);
  const res = await auth.api.signUpEmail({ body: { email, password: "correct-horse-battery", name: email.split("@")[0] }, headers, returnHeaders: true });
  const setCookie = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

describe("accounts mode", () => {
  it("refuses sign-up without the invite code", async () => {
    await expect(signUp("nocode@x.dev", null)).rejects.toThrow(/invite code/i);
    await expect(signUp("wrongcode@x.dev", "guess")).rejects.toThrow(/invite code/i);
  });

  it("signs up with the code, and the session cookie identifies the user", async () => {
    const cookie = await signUp("ada@x.dev", "club-2026");
    expect(cookie).toMatch(/session_token=/);
    const { getCurrentUser, requireUser } = await import("@/lib/auth/session");

    requestHeaders = new Headers({ cookie });
    expect(await getCurrentUser()).toMatchObject({ email: "ada@x.dev", emailVerified: false });

    requestHeaders = new Headers();
    expect(await getCurrentUser()).toBeNull();
    await expect(requireUser()).rejects.toThrow("redirect:/signin");
  });

  it("keeps each user's interviews to themselves", async () => {
    const cookieA = await signUp("grace@x.dev", "club-2026");
    const cookieB = await signUp("linus@x.dev", "club-2026");
    const { getCurrentUser } = await import("@/lib/auth/session");
    requestHeaders = new Headers({ cookie: cookieA });
    const a = (await getCurrentUser())!;
    requestHeaders = new Headers({ cookie: cookieB });
    const b = (await getCurrentUser())!;
    expect(a.id).not.toBe(b.id);

    const { setRecordingConsent } = await import("@/lib/privacy");
    const mock = await import("@/lib/mock");
    await setRecordingConsent(a.id, true);
    const id = await mock.createMockSession(a.id, {
      slug: "pair-with-target-sum",
      config: { persona: "neutral", minutes: 30, hintsAllowed: true, company: null },
      language: "python",
    });
    expect(await mock.getMockSession(id, a.id)).not.toBeNull();
    expect(await mock.getMockSession(id, b.id)).toBeNull();
  });

  it("only treats GitHub-verified ADMIN_EMAILS as research reviewers", async () => {
    process.env.ADMIN_EMAILS = "ada@x.dev";
    const { isAdmin } = await import("@/lib/research/admin");
    expect(isAdmin({ email: "ada@x.dev", emailVerified: false })).toBe(false);
    expect(isAdmin({ email: "ada@x.dev", emailVerified: true })).toBe(true);
    expect(isAdmin({ email: "grace@x.dev", emailVerified: true })).toBe(false);
  });
});
