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

  it("only deletes recordings when the confirming box is ticked", async () => {
    const { deleteRecordingsAction } = await import("@/app/settings/actions");
    const { setRecordingConsent } = await import("@/lib/privacy");
    const { createMockSession, getMockSession } = await import("@/lib/mock");
    const user = await me();
    await setRecordingConsent(user.id, true);
    const id = await createMockSession(user.id, { slug: "pair-with-target-sum", language: "python", config: { persona: "neutral", minutes: 45, hintsAllowed: true, company: null } });
    expect(await redirectOf(deleteRecordingsAction(form({})))).toBe("/settings?confirmRecordings=1");
    expect((await getMockSession(id, user.id))!.purgedAt).toBeNull();
    expect(await redirectOf(deleteRecordingsAction(form({ confirm: "on" })))).toBe("/settings?deleted=recordings");
    expect((await getMockSession(id, user.id))!.purgedAt).toBeInstanceOf(Date);
  });

  it("still surfaces other errors", async () => {
    const { startOrAskConsent } = await import("@/lib/consent-redirect");
    await expect(startOrAskConsent(() => Promise.reject(new Error("boom")), "/x")).rejects.toThrow("boom");
    expect(await startOrAskConsent(() => Promise.resolve(7), "/x")).toBe(7);
  });
});

describe("settings actions", () => {
  it("turns recording consent on and off", async () => {
    const { setConsentAction } = await import("@/app/settings/actions");
    const { getPrivacy } = await import("@/lib/privacy");
    const user = await me();
    await setConsentAction(form({ consent: "on" }));
    expect((await getPrivacy(user.id)).recordingConsent).toBe(true);
    await setConsentAction(form({}));
    expect((await getPrivacy(user.id)).recordingConsent).toBe(false);
  });

  // Last in the file: it deletes the single-user mode user.
  it("deletes everything only when the word delete is typed", async () => {
    const { deleteAllDataAction } = await import("@/app/settings/actions");
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const { saveGoals } = await import("@/lib/track");
    const user = await me();
    await saveGoals(user.id, { targetCompanies: ["google"], level: "mid", interviewDate: null, hoursPerWeek: 5, language: "python", timeZone: null });
    // An older account left over from accounts mode: deleting must not switch to it.
    await db.insert(schema.user).values({ id: "u-older", name: "Older", email: "older@x.dev", createdAt: new Date("2020-01-01T00:00:00Z") });
    const exists = async () => (await db.select().from(schema.goals).where(eq(schema.goals.userId, user.id))).length === 1;

    for (const typed of ["", "delet", "yes", "delete everything"]) {
      expect(await redirectOf(deleteAllDataAction(form({ confirm: typed })))).toBe("/settings?confirm=1");
      expect(await exists()).toBe(true);
    }
    // Case and surrounding spaces don't matter. Single-user mode starts over at onboarding.
    expect(await redirectOf(deleteAllDataAction(form({ confirm: "  Delete " })))).toBe("/onboarding?deleted=1");
    expect(await exists()).toBe(false);
    // The next request is a fresh built-in user, not the older account.
    const next = await me();
    expect(next.id).toBe("local-user");
    expect(await db.select().from(schema.goals).where(eq(schema.goals.userId, next.id))).toEqual([]);
    expect(await db.select().from(schema.user).where(eq(schema.user.id, "u-older"))).toHaveLength(1);
  });
});
