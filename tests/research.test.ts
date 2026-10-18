import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { COMPANY_BY_ID, emphasisFor, patternFrequency, problemAskedByTargets } from "@/lib/engine/companies";
import { buildPlan } from "@/lib/engine/planner";
import { PROBLEMS } from "@/lib/problems";
import { cleanEmphasis, diffProfiles, profileFromEstimate, verifiedSources, type ProfileData } from "@/lib/research/profiles";
import { cleanQuestions, diffQuestions, estimatedQuestions, matchProblem, problemFrequency, type QuestionReport } from "@/lib/research/questions";

describe("research profiles", () => {
  it("cleans emphasis from the model", () => {
    expect(cleanEmphasis({ graphs: 0.83, trees: 1.4, "not-a-pattern": 0.9, heap: 0.04, stack: Number.NaN })).toEqual({ graphs: 0.85, trees: 1 });
  });

  it("keeps only sources the searches returned", () => {
    const seen = new Map([
      ["https://example.com/meta-ai-round", { title: "Meta's AI round", published: "2026-08" }],
      ["https://blog.dev/loop/", { title: "My loop" }],
    ]);
    const out = verifiedSources(
      [
        { url: "https://example.com/meta-ai-round?utm=x", title: "" },
        { url: "https://made-up.example/report", title: "Invented" },
        { url: "https://blog.dev/loop", title: "Loop write-up" },
        { url: "https://blog.dev/loop/#top", title: "Duplicate" },
      ],
      seen,
    );
    expect(out).toEqual([
      { url: "https://example.com/meta-ai-round", title: "Meta's AI round", published: "2026-08" },
      { url: "https://blog.dev/loop/", title: "Loop write-up" },
    ]);
  });

  it("describes what changed and ignores noise", () => {
    const prev = profileFromEstimate(COMPANY_BY_ID.meta);
    expect(diffProfiles(prev, { ...prev, emphasis: { ...prev.emphasis, graphs: (prev.emphasis.graphs ?? 0) + 0.1 } })).toEqual([]);

    const next: ProfileData = {
      ...prev,
      ai: "some-rounds",
      emphasis: { ...prev.emphasis, graphs: 0.95, "linked-list": 0.2 },
      loop: "Two coding rounds, one of them AI-enabled.",
      notes: ["Since 2026 one coding round allows an AI assistant."],
    };
    const changes = diffProfiles(prev, next);
    expect(changes[0]).toBe("AI allowed in some rounds.");
    expect(changes).toContain("More Graphs (BFS/DFS).");
    expect(changes).toContain("Less Linked List.");
    expect(changes).toContain("Loop reported: Two coding rounds, one of them AI-enabled.");
    expect(changes).toContain("Since 2026 one coding round allows an AI assistant.");
    // The same notes again aren't news.
    expect(diffProfiles(next, { ...next })).toEqual([]);
  });

  it("company helpers use live profiles when given", () => {
    const live = { ...COMPANY_BY_ID, meta: { ...COMPANY_BY_ID.meta, name: "Meta Platforms", emphasis: { graphs: 1 } } };
    expect(emphasisFor("meta", "graphs", live)).toBe(1);
    expect(emphasisFor("meta", "graphs")).toBe(COMPANY_BY_ID.meta.emphasis.graphs);
    expect(patternFrequency(["meta"], "stack", live)).toBe(0.3);
    expect(problemAskedByTargets(["Meta Platforms"], ["meta"], live)).toBe(true);
    expect(problemAskedByTargets(["Meta Platforms"], ["meta"])).toBe(false);
  });
});

describe("question frequency", () => {
  const src = { url: "https://example.com/a", title: "A" };
  const verify = (url: string) => (url === src.url ? src : null);

  it("matches reported questions to bank problems by link or title", () => {
    expect(matchProblem("anything", "https://leetcode.com/problems/two-sum/description/", PROBLEMS)?.slug).toBe("pair-with-target-sum");
    expect(matchProblem("1. Two Sum", undefined, PROBLEMS)?.slug).toBe("pair-with-target-sum");
    expect(matchProblem("Not A Real Problem", undefined, PROBLEMS)).toBeNull();
  });

  it("keeps only sourced questions and merges duplicates at the higher frequency", () => {
    const out = cleanQuestions(
      [
        { title: "Two Sum", frequency: "low", sourceUrl: src.url },
        { title: "two sum", url: "https://leetcode.com/problems/two-sum/", frequency: "high", sourceUrl: src.url },
        { title: "Invented", frequency: "high", sourceUrl: "https://made-up.example" },
        { title: "Unbanked", url: "javascript:alert(1)", frequency: "medium", sourceUrl: src.url },
      ],
      verify,
      PROBLEMS,
    );
    expect(out.map((q) => [q.title, q.problemSlug, q.frequency, q.url])).toEqual([
      ["Two Sum", "pair-with-target-sum", "high", undefined],
      ["Unbanked", null, "medium", undefined],
    ]);
  });

  it("estimates from the bank and reports changes", () => {
    const est = estimatedQuestions("Meta", PROBLEMS);
    expect(est.find((q) => q.problemSlug === "pair-with-target-sum")).toMatchObject({ title: "Two Sum", frequency: "medium" });
    const next: QuestionReport[] = [
      { title: "Two Sum", problemSlug: "pair-with-target-sum", frequency: "high", sources: [src] },
      { title: "Rare One", problemSlug: null, frequency: "low", sources: [src] },
    ];
    expect(diffQuestions(est, next)).toEqual(["Asked more often: Two Sum."]);
    expect(diffQuestions(next, next)).toEqual([]);
  });

  it("pulls reported problems up the plan", () => {
    const byCompany = new Map<string, QuestionReport[]>([["stripe", [{ title: "X", problemSlug: PROBLEMS[0].slug, frequency: "high", sources: [] }]]]);
    const qf = problemFrequency(["stripe"], byCompany);
    expect(qf.get(PROBLEMS[0].slug)).toBe(1);
    const base = {
      now: new Date("2026-10-12T12:00:00Z"),
      goals: { targetCompanies: ["stripe"], interviewDate: null, hoursPerWeek: 70 },
      skills: {},
      attempts: [],
      cards: [],
      problems: PROBLEMS,
    };
    const score = (plan: ReturnType<typeof buildPlan>) => plan.items.find((i) => i.slug === PROBLEMS[0].slug)?.components.frequency ?? null;
    const withQf = score(buildPlan({ ...base, questionFrequency: qf }));
    const without = score(buildPlan({ ...base, questionFrequency: new Map() }));
    expect(without).not.toBeNull();
    expect(withQf!).toBeGreaterThan(without!);
  });
});

// The job end to end against an embedded database, with the Claude step faked.
const fake = vi.hoisted(() => ({ changeMeta: true, fail: new Set<string>() }));
vi.mock("@/lib/research/claude", () => ({
  researchCompany: async (id: string, current: ProfileData) => {
    if (fake.fail.has(id)) throw new Error("search failed");
    const data = id === "meta" && fake.changeMeta ? { ...current, ai: "some-rounds", emphasis: { ...current.emphasis, graphs: 1 } } : current;
    const source = { url: `https://example.com/${id}`, title: `${id} report` };
    const questions =
      id === "meta" && fake.changeMeta
        ? [
            { title: "Two Sum", url: "https://leetcode.com/problems/two-sum/", problemSlug: "pair-with-target-sum", frequency: "high", sources: [source] },
            { title: "Some Unbanked Puzzle", problemSlug: null, frequency: "medium", sources: [source] },
          ]
        : [];
    return { data, sources: [source], questions, confidence: "high" };
  },
}));

describe("research job", () => {
  beforeAll(() => {
    process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "research-db-"));
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("queues changes, verifies the rest, and applies approvals", async () => {
    const r = await import("@/lib/research");
    fake.fail.add("stripe");
    const run = await r.runResearch("cli");
    expect(run?.status).toBe("done");
    const byId = Object.fromEntries(run!.results.map((x) => [x.companyId, x.result]));
    expect(byId.meta).toBe("queued");
    expect(byId.google).toBe("unchanged");
    expect(byId.stripe).toBe("failed");

    // Unchanged companies are verified with sources; the planner still uses the old Meta profile.
    const approved = await r.getApprovedProfiles();
    expect(approved.get("google")?.verifiedAt).toBeInstanceOf(Date);
    expect(approved.get("google")?.sources[0].url).toBe("https://example.com/google");
    expect((await r.getLiveCompanies()).meta.emphasis.graphs).toBe(COMPANY_BY_ID.meta.emphasis.graphs);

    const queue = await r.getReviewQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].pending.version).toBe(2);
    expect(queue[0].current?.version).toBe(1);
    expect(queue[0].pending.changes).toContain("AI allowed in some rounds.");
    expect(queue[0].pending.changes).toContain("Asked more often: Two Sum.");
    expect(queue[0].pending.changes).toContain("Newly reported questions: Some Unbanked Puzzle.");
    expect(queue[0].questions.map((q) => q.title)).toEqual(["Two Sum", "Some Unbanked Puzzle"]);
    // Until approved, the planner keeps the bank's estimate for Meta.
    expect((await r.getLiveQuestions()).get("meta")?.find((q) => q.problemSlug === "pair-with-target-sum")?.frequency).toBe("medium");
    expect(await r.pendingCount()).toBe(1);

    await r.reviewProfile(queue[0].pending.id, "approved", "admin@example.com");
    await expect(r.reviewProfile(queue[0].pending.id, "approved", "admin@example.com")).rejects.toThrow();
    const history = await r.getProfileHistory("meta");
    expect(history.map((v) => [v.version, v.status])).toEqual([
      [2, "approved"],
      [1, "approved"],
    ]);

    const live = (await r.getLiveQuestions()).get("meta")!;
    expect(live.map((q) => [q.title, q.frequency])).toEqual([
      ["Two Sum", "high"],
      ["Some Unbanked Puzzle", "medium"],
    ]);

    const news = await r.getWhatsNew(["google", "meta"]);
    expect(news.map((n) => n.companyId)).toEqual(["meta"]);
    expect(news[0].sources[0].url).toBe("https://example.com/meta");
  });

  it("skips without an API key", async () => {
    const r = await import("@/lib/research");
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const run = await r.runResearch("cron");
      expect(run?.status).toBe("skipped");
      expect(run?.error).toMatch(/ANTHROPIC_API_KEY/);
    } finally {
      process.env.ANTHROPIC_API_KEY = key;
    }
  });
});

describe("research reviewers", () => {
  it("requires a verified email on the admin list", async () => {
    const { isAdmin } = await import("@/lib/research/admin");
    const prev = process.env.ADMIN_EMAILS;
    const prevMode = process.env.AUTH_MODE;
    process.env.ADMIN_EMAILS = "jason@example.com, other@example.com";
    process.env.AUTH_MODE = "accounts";
    try {
      expect(isAdmin({ email: "Jason@example.com", emailVerified: true })).toBe(true);
      expect(isAdmin({ email: "jason@example.com", emailVerified: false })).toBe(false);
      expect(isAdmin({ email: "someone@example.com", emailVerified: true })).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = prev;
      if (prevMode === undefined) delete process.env.AUTH_MODE;
      else process.env.AUTH_MODE = prevMode;
    }
  });

  it("makes the local user the reviewer in single-user mode", async () => {
    const { isAdmin } = await import("@/lib/research/admin");
    const prev = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "jason@example.com";
    try {
      expect(isAdmin({ email: "me@localhost", emailVerified: false })).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = prev;
    }
  });
});
