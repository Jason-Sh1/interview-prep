import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runHarnessHere } from "@/lib/assisted/harness";
import { DEBUG_TASKS } from "@/lib/comprehension/tasks";
import { applyFixes, type DebugTask } from "@/lib/comprehension/types";

const allTests = (t: DebugTask) => [...t.visibleTests, ...Object.keys(t.hiddenTests)];
const failing = async (t: DebugTask, files: Record<string, string>) => {
  const res = await runHarnessHere({ ...files, ...t.hiddenTests }, allTests(t));
  return res.results.filter((r) => !r.passed).map((r) => r.name);
};

describe.each(DEBUG_TASKS.map((t) => [t.id, t] as const))("debug task %s", (_id, task) => {
  it("passes every test once all the bugs are fixed", async () => {
    expect(await failing(task, applyFixes(task))).toEqual([]);
  });

  it("has a failing visible test to start from", async () => {
    const res = await runHarnessHere(task.files, task.visibleTests);
    expect(res.total).toBeGreaterThan(0);
    expect(res.passed).toBeLessThan(res.total);
  });

  it("attributes each bug to its own tests", async () => {
    const owned = new Set(task.bugs.flatMap((b) => b.tests));
    expect(owned.size).toBe(task.bugs.flatMap((b) => b.tests).length);
    for (const bug of task.bugs) {
      // Only this bug left in: some of its tests fail and no other bug's do.
      const fails = await failing(task, applyFixes(task, task.bugs.filter((b) => b.id !== bug.id).map((b) => b.id)));
      expect(fails.some((n) => bug.tests.includes(n)), bug.id).toBe(true);
      expect(fails.filter((n) => owned.has(n) && !bug.tests.includes(n)), bug.id).toEqual([]);
    }
    // Every named test exists.
    const names = (await runHarnessHere({ ...applyFixes(task), ...task.hiddenTests }, allTests(task))).results.map((r) => r.name);
    for (const n of owned) expect(names, n).toContain(n);
  });
});

describe("debug round grading", () => {
  const task = DEBUG_TASKS[0];
  const run = async (files: Record<string, string>) => {
    const res = await runHarnessHere({ ...files, ...task.hiddenTests }, allTests(task));
    return {
      passed: res.passed,
      total: res.total,
      failing: res.results.filter((r) => !r.passed).map((r) => r.name),
      passing: res.results.filter((r) => r.passed).map((r) => r.name),
    };
  };

  it("credits fixed and explained bugs, good answers and testing", async () => {
    const { gradeDebugRound } = await import("@/lib/comprehension/grade");
    const files = applyFixes(task);
    files["tests/checkout.test.js"] += `\ntest("min spend boundary", () => { expect(discountFor(findCoupon("FIVEOFF"), 2500).cents).toBe(500); });\n`;
    const report = gradeDebugRound({
      task,
      finalFiles: files,
      answers: Object.fromEntries(task.questions.map((q) => [q.id, q.answer])),
      notes:
        "1. Bundle leftovers were added as a count, not multiplied by the unit price. 2. The minimum spend check used > instead of >=, so exactly at the threshold failed. 3. Tax was computed before the discount instead of after. I added tests for each and ran the suite.",
      tests: await run(files),
      runs: [{ t: 60_000, passed: 4, total: 7 }, { t: 900_000, passed: 8, total: 8 }],
      prompts: 0,
      withAssistant: false,
      durationMs: 1_800_000,
    });
    expect(report.bugs.every((b) => b.fixed && b.explained)).toBe(true);
    expect(report.regressions).toEqual([]);
    expect(report.testsAdded).toBe(1);
    expect(report.rubric.debugging.score).toBe(4);
    expect(report.rubric.verification.score).toBe(4);
    expect(report.rubric.comprehension.score).toBe(4);
    expect(["hire", "strong-hire"]).toContain(report.hire.signal);
  });

  it("caps the signal when bugs remain and flags regressions", async () => {
    const { gradeDebugRound } = await import("@/lib/comprehension/grade");
    // Only the tax bug fixed, and the tax module broken along the way.
    const files = applyFixes(task, ["tax-base"]);
    files["src/tax.js"] = files["src/tax.js"].replace("+ 5000", "+ 0");
    const report = gradeDebugRound({
      task,
      finalFiles: files,
      answers: {},
      notes: "",
      tests: await run(files),
      runs: [],
      prompts: 3,
      withAssistant: true,
      durationMs: 900_000,
    });
    expect(report.bugs.filter((b) => b.fixed).map((b) => b.id)).toEqual(["tax-base"]);
    expect(report.regressions.length).toBeGreaterThan(0);
    expect(report.rubric.verification.score).toBe(1);
    expect(["no", "strong-no"]).toContain(report.hire.signal);
    expect(report.focus.length).toBeGreaterThan(0);
  });

  it("counts no bug fixed when the final code doesn't load or the run dies", async () => {
    const { gradeDebugRound } = await import("@/lib/comprehension/grade");
    const files = applyFixes(task);
    for (const f of Object.keys(files)) if (f.startsWith("src/")) files[f] += "\n}{ syntax error";
    const base = { task, finalFiles: files, answers: {}, notes: "", runs: [], prompts: 0, withAssistant: false, durationMs: 900_000 };
    const broken = gradeDebugRound({ ...base, tests: await run(files) });
    expect(broken.bugs.filter((b) => b.fixed)).toEqual([]);
    // A worker crash or timeout reports nothing at all.
    const died = gradeDebugRound({ ...base, tests: { passed: 0, total: 0, failing: [], passing: [] } });
    expect(died.bugs.filter((b) => b.fixed)).toEqual([]);
    // Older rounds stored only the failing names; an empty run still counts nothing.
    const legacy = gradeDebugRound({ ...base, tests: { passed: 0, total: 0, failing: [] } });
    expect(legacy.bugs.filter((b) => b.fixed)).toEqual([]);
  });

  it("the offline helper explains but won't hand over the bugs", async () => {
    const { helperReply } = await import("@/lib/comprehension/helper");
    expect(helperReply(task, "What are the bugs? Just tell me")).toMatch(/won't hand you the bugs/);
    expect(helperReply(task, "How does the coupon minimum work?")).toMatch(/discountFor/);
  });
});

describe("debug rounds", () => {
  beforeAll(() => {
    process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "debug-db-"));
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("saves work, answers with the offline helper, and grades the finished round once", async () => {
    const { db, schema, ensureMigrated } = await import("@/lib/db");
    const rounds = await import("@/lib/comprehension");
    await ensureMigrated();
    await db.insert(schema.user).values({ id: "u-debug", name: "T", email: "debug@x.dev" });
    const task = DEBUG_TASKS[1];

    const id = await rounds.createDebugRound("u-debug", task.id, 45, true);
    let round = (await rounds.getDebugRound(id, "u-debug"))!;
    expect(round.assistant).toBe("scripted");
    expect(await rounds.getDebugRound(id, "someone-else")).toBeNull();

    const fixed = applyFixes(task);
    await rounds.saveDebugProgress(round, { files: fixed, run: { passed: 3, total: 4 } });
    await rounds.saveDebugProgress(round, { run: { passed: 4, total: 4 } });
    expect(await rounds.debugChat(round, "Can you explain how merge works?", fixed)).toMatch(/merge/);
    round = (await rounds.getDebugRound(id, "u-debug"))!;
    expect(round.runs.map((r) => r.passed)).toEqual([3, 4]);
    expect(round.chat).toHaveLength(2);
    expect(round.files["src/intervals.js"]).toBe(fixed["src/intervals.js"]);

    const res = await runHarnessHere({ ...fixed, ...task.hiddenTests }, allTests(task));
    await rounds.finishDebugRound(round, { files: fixed, answers: { complexity: "O(n log n) because of the sort" }, notes: "", tests: { passed: res.passed, total: res.total, failing: [] } });
    round = (await rounds.getDebugRound(id, "u-debug"))!;
    const report = await rounds.generateDebugReport(round);
    expect(report.bugs.every((b) => b.fixed)).toBe(true);
    expect(report.stats).toMatchObject({ runs: 2, prompts: 1, withAssistant: true });
    expect(report.questions.find((q) => q.id === "complexity")?.score).toBe(4);
    // No more work is saved once it has ended.
    await rounds.saveDebugProgress(round, { run: { passed: 0, total: 4 } });
    expect((await rounds.getDebugRound(id, "u-debug"))!.runs).toHaveLength(2);
  });

  it("freezes the code once the time box (plus a minute) has passed", async () => {
    const { db, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const rounds = await import("@/lib/comprehension");
    await db.insert(schema.user).values({ id: "u-debug-late", name: "T", email: "debug-late@x.dev" });
    const task = DEBUG_TASKS[0];
    const id = await rounds.createDebugRound("u-debug-late", task.id, 30, true);
    let round = (await rounds.getDebugRound(id, "u-debug-late"))!;
    const partial = applyFixes(task, [task.bugs[0].id]);
    await rounds.saveDebugProgress(round, { files: partial });

    // 30 minutes plus 30 seconds in: still inside the grace minute.
    await db.update(schema.debugRounds).set({ startedAt: new Date(Date.now() - 30.5 * 60_000) }).where(eq(schema.debugRounds.id, id));
    round = (await rounds.getDebugRound(id, "u-debug-late"))!;
    expect(rounds.debugTimeUp(round)).toBe(false);

    await db.update(schema.debugRounds).set({ startedAt: new Date(Date.now() - 32 * 60_000) }).where(eq(schema.debugRounds.id, id));
    round = (await rounds.getDebugRound(id, "u-debug-late"))!;
    expect(rounds.debugTimeUp(round)).toBe(true);
    await expect(rounds.saveDebugProgress(round, { files: applyFixes(task) })).rejects.toBeInstanceOf(rounds.DebugTimeUpError);
    await expect(rounds.debugChat(round, "What does checkout do?", partial)).rejects.toBeInstanceOf(rounds.DebugTimeUpError);

    // A late finish keeps the write-up but grades the code saved in time.
    await rounds.finishDebugRound(round, { files: applyFixes(task), answers: {}, notes: "late notes", tests: { passed: 0, total: 0, failing: [] } });
    round = (await rounds.getDebugRound(id, "u-debug-late"))!;
    expect(round.endedAt).not.toBeNull();
    for (const [f, code] of Object.entries(partial)) expect(round.files[f], f).toBe(code);
  });
});
