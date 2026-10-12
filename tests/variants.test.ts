import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PROBLEM_BY_SLUG } from "@/lib/problems";
import { draftToVariant, variantProblem, type VariantDraft } from "@/lib/variants/shape";

const base = PROBLEM_BY_SLUG.get("pair-with-target-sum")!;

/** A follow-up twist on two-sum: count the pairs instead of returning one. */
const draft = (over: Partial<VariantDraft> = {}): VariantDraft => ({
  title: "Count Target Pairs",
  twist: "Now count every pair of positions that adds up to the target.",
  statement: "Given `nums` and `target`, return how many pairs `i < j` have `nums[i] + nums[j] == target`.",
  constraints: ["0 <= nums.length <= 10^5"],
  hints: ["Think about what you've seen so far.", "Count values in a map as you go.", "for x in nums: ans += seen[target - x]; seen[x] += 1"],
  complexity: { time: "O(n)", space: "O(n)" },
  functionName: "countPairs",
  params: [
    { name: "nums", type: "int[]" },
    { name: "target", type: "int" },
  ],
  returns: "int",
  compare: "exact",
  reference: `function countPairs(nums, target) {
  const seen = new Map();
  let n = 0;
  for (const x of nums) {
    n += seen.get(target - x) ?? 0;
    seen.set(x, (seen.get(x) ?? 0) + 1);
  }
  return n;
}`,
  tests: [
    { input: "[[1,2,3,4],5]", expected: "2", sample: true },
    { input: "[[3,3,3],6]", expected: "3", sample: true, label: "duplicates" },
    { input: "[[],1]", expected: "0", sample: false, label: "empty" },
    { input: "[[5],10]", expected: "0", sample: false, label: "single" },
    { input: "[[-1,1,0,0],0]", expected: "2", sample: false, label: "negatives" },
  ],
  ...over,
});

describe("variant drafts", () => {
  it("parses a good draft and rejects broken ones", () => {
    const v = draftToVariant(draft());
    expect(v.signature).toEqual({ kind: "function", name: "countPairs", params: draft().params, returns: "int" });
    expect(v.tests[0]).toEqual({ input: [[1, 2, 3, 4], 5], expected: 2, sample: true });
    expect(() => draftToVariant(draft({ functionName: "count-pairs" }))).toThrow(/function name/);
    expect(() => draftToVariant(draft({ tests: [{ input: "[[1]", expected: "1", sample: true }] }))).toThrow(/JSON/);
    expect(() => draftToVariant(draft({ tests: draft().tests.slice(0, 3) }))).toThrow(/five tests/);
    expect(() => draftToVariant(draft({ reference: "function other() {}" }))).toThrow(/reference/);
  });

  it("keeps the base problem's slug, pattern and rating", () => {
    const p = variantProblem(base, draftToVariant(draft()));
    expect(p).toMatchObject({ slug: base.slug, pattern: base.pattern, rating: base.rating, title: "Count Target Pairs" });
    expect(p.source).toBeUndefined();
  });
});

describe("variant store", () => {
  beforeAll(() => {
    process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "variants-db-"));
  });

  it("only keeps drafts whose reference passes their own tests, in a locked-down process", async () => {
    const { checkReference } = await import("@/lib/variants");
    expect((await checkReference(draftToVariant(draft()))).verdict).toBe("accepted");
    const wrong = draft({ tests: [...draft().tests.slice(0, 4), { input: "[[1,4],5]", expected: "2", sample: false }] });
    expect((await checkReference(draftToVariant(wrong))).verdict).not.toBe("accepted");
    const target = path.join(tmpdir(), `variant-escape-${Date.now()}`);
    const sneaky = draft({ reference: `function countPairs() { require("fs").writeFileSync(${JSON.stringify(target)}, "x"); return 0; }` });
    expect((await checkReference(draftToVariant(sneaky))).verdict).not.toBe("accepted");
    expect(existsSync(target)).toBe(false);
    // No route to the network or the real process, even through the global object.
    for (const escape of [
      `typeof fetch === "function" || typeof process === "object" || typeof require === "function"`,
      `(function () { try { return !!Function("return this")(); } catch { return false; } })()`,
      `(function () { try { return !![].map.constructor("return process")(); } catch { return false; } })()`,
      `(function () { try { return typeof this === "object" && this !== null; } catch { return false; } })()`,
    ]) {
      const probe = draft({ reference: `function countPairs(nums, k) { if (${escape}) return -1; let c = 0; const seen = new Map(); for (const x of nums) { c += seen.get(k - x) ?? 0; seen.set(x, (seen.get(x) ?? 0) + 1); } return c; }` });
      expect((await checkReference(draftToVariant(probe))).verdict, escape).toBe("accepted");
    }
  });

  it("stores a checked variant, hands it out once per user, and records the review on it", async () => {
    const { db, schema, ensureMigrated } = await import("@/lib/db");
    const variants = await import("@/lib/variants");
    const track = await import("@/lib/track");
    await ensureMigrated();
    await db.insert(schema.user).values({ id: "u-var", name: "T", email: "var@x.dev" });

    let calls = 0;
    const bad = await variants.createVariant(base.slug, async () => {
      calls++;
      return draft({ tests: [...draft().tests.slice(0, 4), { input: "[[1,4],5]", expected: "7", sample: false }] });
    });
    expect(bad).toBeNull();
    expect(calls).toBe(2);

    const v = await variants.createVariant(base.slug, async (_p, avoid) => {
      expect(avoid).toEqual([]);
      return draft();
    });
    expect(v?.data.title).toBe("Count Target Pairs");
    expect((await variants.pickVariant("u-var", base.slug))?.id).toBe(v!.id);
    expect((await variants.variantsWaiting("u-var", [base.slug])).get(base.slug)?.id).toBe(v!.id);

    const input = {
      slug: base.slug,
      mode: "review" as const,
      language: "python" as const,
      solved: true,
      gaveUp: false,
      startedAt: new Date().toISOString(),
      secondsToFirstRun: 60,
      secondsToAccepted: 300,
      runCount: 1,
      failedRuns: 0,
      failingLabels: [],
      hintsUsed: 0,
      confidence: 3 as const,
      // The variant's complexity is what counts.
      complexityChoice: "O(n)",
      code: "def count_pairs(nums, target): ...",
      variantId: v!.id,
    };
    const result = await track.recordAttempt("u-var", { ...input, mode: "review" });
    expect(result.solved).toBe(true);
    const [row] = await db.select().from(schema.attempts);
    expect(row).toMatchObject({ problemSlug: base.slug, variantId: v!.id, complexityCorrect: true });
    expect(await variants.pickVariant("u-var", base.slug)).toBeNull();

    // A variant id that belongs to another problem is refused.
    await expect(track.recordAttempt("u-var", { ...input, slug: "bucket-the-anagrams" })).rejects.toThrow(/variant/);
  });

  it("does nothing without an API key", async () => {
    const variants = await import("@/lib/variants");
    delete process.env.ANTHROPIC_API_KEY;
    await expect(variants.ensureVariant("u-var", base.slug)).resolves.toBeUndefined();
  });
});
