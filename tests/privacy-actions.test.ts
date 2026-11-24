import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The server actions behind the start forms and Settings, in single-user mode
// against an embedded database. redirect() is stubbed to throw, as the real one
// does, so a test can see where the user was sent.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

beforeAll(async () => {
  process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "privacy-actions-db-"));
  delete process.env.AUTH_MODE;
  delete process.env.VERCEL;
  delete process.env.ANTHROPIC_API_KEY;
  await (await import("@/lib/db")).ensureMigrated();
}, 120_000);

/** The single-user mode user, with consent cleared before each test. */
async function me() {
  const { requireUser } = await import("@/lib/auth/session");
  return requireUser();
}

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

/** Runs a server action that ends in redirect(), and returns where it went. */
async function redirectOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const m = /^redirect:(.*)$/.exec((e as Error).message);
    if (m) return m[1];
    throw e;
  }
  throw new Error("expected a redirect");
}

describe("start actions and recording consent", () => {
  beforeEach(async () => {
    const { setRecordingConsent } = await import("@/lib/privacy");
    await setRecordingConsent((await me()).id, false);
  });

  it("sends a behavioral start without consent back to the page with a note, not an error", async () => {
    const { startBehavioralRoundAction } = await import("@/app/behavioral/actions");
    const { listRounds } = await import("@/lib/rounds");
    const user = await me();
    const fields = { topic: "amazon-lp", minutes: "20", persona: "neutral", company: "" };
    expect(await redirectOf(startBehavioralRoundAction(form(fields)))).toBe("/behavioral?consent=required");
    expect(await listRounds(user.id, "behavioral")).toEqual([]);

    // Ticking the box records consent and starts the round.
    const to = await redirectOf(startBehavioralRoundAction(form({ ...fields, consent: "on" })));
    const [round] = await listRounds(user.id, "behavioral");
    expect(to).toBe(`/behavioral/${round.id}`);
    const { getPrivacy } = await import("@/lib/privacy");
    expect((await getPrivacy(user.id)).recordingConsent).toBe(true);
  });

  it("does the same for design rounds and mock interviews", async () => {
    const { startRoundAction } = await import("@/app/rounds/actions");
    const { startMockAction } = await import("@/app/mock/actions");
    const design = { kind: "design", topic: "url-shortener", minutes: "45", persona: "neutral", company: "" };
    expect(await redirectOf(startRoundAction(form(design)))).toBe("/design?consent=required");
    const mock = { slug: "pair-with-target-sum", persona: "neutral", minutes: "45", company: "", language: "python" };
    expect(await redirectOf(startMockAction(form(mock)))).toBe("/mock?problem=pair-with-target-sum&consent=required");
    expect(await redirectOf(startRoundAction(form({ ...design, consent: "on" })))).toMatch(/^\/design\/[0-9a-f-]{36}$/);
  });

  it("still surfaces other errors", async () => {
    const { startOrAskConsent } = await import("@/lib/consent-redirect");
    await expect(startOrAskConsent(() => Promise.reject(new Error("boom")), "/x")).rejects.toThrow("boom");
    expect(await startOrAskConsent(() => Promise.resolve(7), "/x")).toBe(7);
  });
});
