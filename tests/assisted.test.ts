import { describe, expect, it } from "vitest";
import { runHarnessHere } from "@/lib/assisted/harness";
import { TASKS } from "@/lib/assisted/tasks";
import { mutate } from "@/lib/assisted/tasks/util";

describe("harness", () => {
  it("resolves requires, runs sync and async tests, and reports failures", async () => {
    const res = await runHarnessHere(
      {
        "src/a.js": "const b = require('./lib/b'); module.exports = { twice: (x) => b.add(x, x) };",
        "src/lib/b.js": "exports.add = (x, y) => x + y;",
        "tests/a.test.js": [
          "const { twice } = require('../src/a');",
          "test('sync', () => { expect(twice(2)).toBe(4); expect({ a: [1] }).toEqual({ a: [1] }); });",
          "describe('group', () => { test('async', async () => { await null; expect(twice(1)).not.toBe(3); }); });",
          "test('fails', () => { expect([1, 2]).toContain(3); });",
          "test('throws', () => { expect(() => { throw new Error('x'); }).toThrow(); });",
        ].join("\n"),
      },
      ["tests/a.test.js"],
    );
    expect(res.total).toBe(4);
    expect(res.passed).toBe(3);
    expect(res.results.find((r) => !r.passed)).toMatchObject({ name: "fails", error: expect.stringContaining("to contain 3") });
    expect(res.results.map((r) => r.name)).toContain("group > async");
  });

  it("reports a test file that fails to load instead of crashing", async () => {
    const res = await runHarnessHere({ "t.test.js": "require('./missing');" }, ["t.test.js"]);
    expect(res.passed).toBe(0);
    expect(res.results[0].error).toMatch(/Cannot find module/);
  });

  it("only allows requiring files in the repo", async () => {
    const res = await runHarnessHere({ "t.test.js": "require('fs');" }, ["t.test.js"]);
    expect(res.results[0].error).toMatch(/only files in this repo/);
  });
});

describe.each(TASKS.map((t) => [t.id, t] as const))("task %s", (_id, task) => {
  const allTests = [...task.visibleTests, ...Object.keys(task.hiddenTests)];

  it("passes every visible and hidden test with the reference solution", async () => {
    const res = await runHarnessHere({ ...task.reference, ...task.hiddenTests }, allTests);
    expect(res.results.filter((r) => !r.passed)).toEqual([]);
    expect(res.total).toBeGreaterThan(5);
  });

  it("starts unsolved", async () => {
    const res = await runHarnessHere({ ...task.files, ...task.hiddenTests }, allTests);
    expect(res.passed).toBeLessThan(res.total);
  });

  it("has a matching file for every visible test and the entry file", () => {
    for (const f of [...task.visibleTests, task.entry]) expect(task.files[f]).toBeDefined();
  });

  it.each(task.bugs.map((b) => [b.id, b] as const))("catches planted bug %s with the hidden tests and its signature", async (_bug, bug) => {
    const buggy = mutate(task.reference, bug.mutate);
    const res = await runHarnessHere({ ...buggy, ...task.hiddenTests }, allTests);
    expect(res.passed).toBeLessThan(res.total);
    const re = new RegExp(bug.signature);
    expect(re.test(buggy[bug.mutate.path])).toBe(true);
    expect(Object.values(task.reference).some((src) => re.test(src))).toBe(false);
  });

  it("puts each planted bug in a scripted answer, and that answer contains the signature", () => {
    for (const bug of task.bugs) {
      const variant = task.topics.flatMap((t) => t.buggy ?? []).find((b) => b.bug === bug.id);
      expect(variant, bug.id).toBeDefined();
      expect(new RegExp(bug.signature).test(variant!.reply)).toBe(true);
    }
    for (const topic of task.topics) {
      for (const bug of task.bugs) expect(new RegExp(bug.signature).test(topic.reply), `${topic.id} vs ${bug.id}`).toBe(false);
    }
  });
});

import { aiShare, gradePrompt, gradeRound } from "@/lib/assisted/grade";
import { INITIAL_SCRIPTED_STATE, scriptedReply, type ScriptedState } from "@/lib/assisted/scripted";
import { rateLimitTask } from "@/lib/assisted/tasks/rate-limit";
import type { AssistedEvent } from "@/lib/assisted/types";

describe("practice assistant", () => {
  it("answers by keyword, plants a bug by the second code answer, and corrects it when flagged", () => {
    let state: ScriptedState = INITIAL_SCRIPTED_STATE;
    const planted: string[] = [];
    for (const prompt of ["Write the sliding window limiter in rateLimiter.js", "Now wire the handler to return 429 with Retry-After"]) {
      const res = scriptedReply(rateLimitTask, state, prompt, "seed-1");
      expect(res.text).toContain("```js");
      if (res.planted) planted.push(res.planted.id);
      state = res.state;
    }
    expect(planted.length).toBeGreaterThan(0);
    const fix = scriptedReply(rateLimitTask, state, "There's a bug in the limiter or the handler you gave me", "seed-1");
    expect(fix.text).toMatch(/You're right/);
    expect(fix.state.pending).toHaveLength(planted.length - 1);
  });

  it("explains the repo and falls back to guidance for unknown questions", () => {
    expect(scriptedReply(rateLimitTask, INITIAL_SCRIPTED_STATE, "Can you explain the codebase structure?", "s").text).toMatch(/Quick tour/);
    expect(scriptedReply(rateLimitTask, INITIAL_SCRIPTED_STATE, "hello there", "s").text).toMatch(/I can help with this repo/);
  });

  it("never plants the same bug twice", () => {
    let state: ScriptedState = INITIAL_SCRIPTED_STATE;
    const ids: string[] = [];
    for (let i = 0; i < 8; i++) {
      const res = scriptedReply(rateLimitTask, state, "limiter window please", `seed-${i % 3}`);
      if (res.planted) ids.push(res.planted.id);
      state = res.state;
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("assisted grading", () => {
  const task = rateLimitTask;
  const buggyReply = task.topics[0].buggy![0];
  const bug = task.bugs.find((b) => b.id === buggyReply.bug)!;
  const buggyFiles = mutate(task.reference, bug.mutate);
  const allPass = { passed: 14, total: 14, failing: [] };

  const base = (extra: AssistedEvent[]): AssistedEvent[] => [
    { type: "prompt", t: 10_000, payload: { text: "Explain how src/handler.js and rateLimiter.js fit together", model: "practice" } },
    { type: "reply", t: 12_000, payload: { text: task.topics[3].reply, model: "practice" } },
    { type: "prompt", t: 60_000, payload: { text: "Write createRateLimiter in src/rateLimiter.js: at most max requests per windowMs, rejected requests shouldn't count", model: "practice" } },
    { type: "reply", t: 62_000, payload: { text: buggyReply.reply, model: "practice", planted: { id: bug.id, description: bug.description } } },
    { type: "paste", t: 70_000, payload: { path: "src/rateLimiter.js", chars: 500, fromAssistant: true } },
    { type: "snapshot", t: 71_000, payload: { files: buggyFiles } },
    { type: "run", t: 80_000, payload: { passed: 2, total: 3, failing: ["allows up to the limit, then answers 429"] } },
    ...extra,
  ];

  it("credits catching a planted bug, focused prompts and a full explanation", () => {
    const r = gradeRound({
      task,
      events: base([{ type: "prompt", t: 90_000, payload: { text: "That limiter is off by one, it lets 6 through", model: "practice" } }]),
      finalFiles: task.reference,
      explanation:
        "I implemented createRateLimiter in src/rateLimiter.js as a sliding window of timestamps per client and wired it into handle in src/handler.js, returning 429 with Retry-After in whole seconds. The assistant's limiter was off by one (it used > instead of >=), which the tests caught, so I fixed the comparison. I ran the tests after every change and checked the window boundary.",
      tests: allPass,
      durationMs: 30 * 60_000,
    });
    expect(r.bugs).toHaveLength(1);
    expect(r.bugs[0].outcome).toBe("caught");
    expect(r.rubric.review.score).toBe(4);
    expect(r.rubric.correctness.score).toBe(4);
    expect(r.rubric.decomposition.score).toBe(4);
    expect(r.rubric.ownership.score).toBe(4);
    expect(["hire", "strong-hire"]).toContain(r.hire.signal);
  });

  it("marks a planted bug left in the final code as missed and caps the signal", () => {
    const r = gradeRound({ task, events: base([]), finalFiles: buggyFiles, explanation: "Done.", tests: { passed: 11, total: 14, failing: ["x"] }, durationMs: 20 * 60_000 });
    expect(r.bugs[0].outcome).toBe("missed");
    expect(r.rubric.review.score).toBe(1);
    expect(r.rubric.ownership.score).toBeLessThanOrEqual(2);
    expect(["no", "lean-hire", "strong-no"]).toContain(r.hire.signal);
    expect(r.focus.map((f) => f.area)).toContain("review");
  });

  it("scores a single do-everything prompt low on decomposition", () => {
    const events: AssistedEvent[] = [
      { type: "prompt", t: 1000, payload: { text: "implement the rate limiter with the sliding window, the 429 retry-after response, the remaining header and per-client x-client-id keys", model: "practice" } },
      { type: "reply", t: 2000, payload: { text: task.topics[0].reply, model: "practice" } },
    ];
    const r = gradeRound({ task, events, finalFiles: task.reference, explanation: "", tests: allPass, durationMs: 60_000 });
    expect(r.rubric.decomposition.score).toBe(1);
  });

  it("grades prompts on naming code, stating behavior and giving context", () => {
    const ids = new Set(["src/ratelimiter.js", "ratelimiter.js", "ratelimiter", "createratelimiter"]);
    expect(gradePrompt("fix it", ids).score).toBe(1);
    expect(gradePrompt("In createRateLimiter, rejected requests should not count against the window; here is what I tried so far and why it fails", ids).score).toBe(4);
  });

  it("measures how much of the new code came from assistant answers", () => {
    expect(aiShare(task, task.files, [])).toBeNull();
    const share = aiShare(task, task.reference, task.topics.map((t) => t.reply));
    expect(share).toBeGreaterThan(0.5);
    expect(aiShare(task, task.reference, [])).toBe(0);
  });
});

describe("practice assistant corrections", () => {
  it("asks which part is wrong when the flagged answer had no planted bug", () => {
    const state: ScriptedState = { ...INITIAL_SCRIPTED_STATE, planted: ["retry-after-ms"], pending: [{ topic: "handler", bug: "retry-after-ms" }], lastBug: null };
    expect(scriptedReply(rateLimitTask, state, "this is wrong", "s").text).toMatch(/not sure which part/);
    expect(scriptedReply(rateLimitTask, state, "the 429 retry-after header is wrong", "s").text).toMatch(/You're right/);
  });
});

import { pastedFromAssistant } from "@/lib/assisted/paste";

describe("paste detection", () => {
  const answer = "Here you go:\n\n```js\nfunction add(a, b) {\n  return a + b;\n}\n```";
  it("counts a paste that adds a line around assistant code", () => {
    expect(pastedFromAssistant("function add(a, b) {\n    return a + b;\n}\nmodule.exports = { add };", [answer])).toBe(true);
  });
  it("ignores the candidate's own code", () => {
    expect(pastedFromAssistant("const x = compute(items);\nconsole.log(x);", [answer])).toBe(false);
  });
});
