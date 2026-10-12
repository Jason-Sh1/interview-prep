import { describe, expect, it } from "vitest";
import { historyMessages } from "@/lib/interview/claude";
import { systemPrompt, turnMessage } from "@/lib/interview/prompt";
import {
  INITIAL_SCRIPT_STATE,
  answerClarifying,
  compareComplexity,
  hasNestedLoop,
  scriptedTurn,
  spokenComplexity,
  type ScriptInput,
  type ScriptState,
} from "@/lib/interview/scripted";
import { applyOps, codeAt, sessionStats, turnContext } from "@/lib/interview/timeline";
import { SILENT, eventSchema, type MockConfig, type SessionEvent, type TurnKind } from "@/lib/interview/types";
import { PROBLEM_BY_SLUG } from "@/lib/problems";
import { starterCode } from "@/lib/runner/drivers";

const twoSum = PROBLEM_BY_SLUG.get("pair-with-target-sum")!;
const config: MockConfig = { persona: "neutral", minutes: 45, hintsAllowed: true, company: null };

describe("timeline", () => {
  it("applies Monaco edits that refer to the pre-edit text", () => {
    expect(applyOps("hello world", [{ offset: 0, length: 5, text: "goodbye" }])).toBe("goodbye world");
    // Two changes in one event (multi-cursor): both offsets are against the original.
    expect(
      applyOps("a b c", [
        { offset: 0, length: 1, text: "xx" },
        { offset: 4, length: 1, text: "yy" },
      ]),
    ).toBe("xx b yy");
    expect(applyOps("abc", [{ offset: 3, length: 0, text: "d" }])).toBe("abcd");
  });

  it("rebuilds the code at any moment from snapshots and edits", () => {
    const events: SessionEvent[] = [
      { type: "snapshot", t: 0, payload: { code: "def f():\n    pass", language: "python" } },
      { type: "edit", t: 1000, payload: { ops: [{ offset: 13, length: 4, text: "return 1" }] } },
      { type: "edit", t: 2000, payload: { ops: [{ offset: 20, length: 1, text: "2" }] } },
      { type: "snapshot", t: 3000, payload: { code: "const f = () => 2;", language: "javascript" } },
      { type: "edit", t: 4000, payload: { ops: [{ offset: 16, length: 1, text: "3" }] } },
    ];
    expect(codeAt(events, 500).code).toBe("def f():\n    pass");
    expect(codeAt(events, 1500).code).toBe("def f():\n    return 1");
    expect(codeAt(events, 2500)).toEqual({ code: "def f():\n    return 2", language: "python" });
    expect(codeAt(events)).toEqual({ code: "const f = () => 3;", language: "javascript" });
  });

  it("validates events and rejects unknown shapes", () => {
    expect(eventSchema.safeParse({ type: "run", t: 5, payload: { scope: "all", verdict: "accepted", passed: 3, total: 3, failingLabels: [] } }).success).toBe(true);
    expect(eventSchema.safeParse({ type: "keystroke", t: 5, payload: {} }).success).toBe(false);
    expect(eventSchema.safeParse({ type: "edit", t: -1, payload: { ops: [] } }).success).toBe(false);
  });

  it("summarizes the moment for the interviewer", () => {
    const starter = starterCode(twoSum.signature, "python");
    const events: SessionEvent[] = [
      { type: "marker", t: 0, payload: { what: "start", detail: "browser" } },
      { type: "snapshot", t: 0, payload: { code: starter, language: "python" } },
      { type: "transcript", t: 30_000, payload: { speaker: "candidate", text: "Can the array be empty?", source: "typed" } },
      { type: "edit", t: 60_000, payload: { ops: [{ offset: starter.length, length: 0, text: "\n# hi" }] } },
      { type: "run", t: 70_000, payload: { scope: "all", verdict: "accepted", passed: 5, total: 5, failingLabels: [] } },
    ];
    const ctx = turnContext(events, { now: 100_000, totalMs: 45 * 60_000, starter });
    expect(ctx.hasCode).toBe(true);
    expect(ctx.everAccepted).toBe(true);
    expect(ctx.sinceCandidateSpokeMs).toBe(70_000);
    expect(ctx.sinceCodeChangedMs).toBe(40_000);
    expect(ctx.remainingMs).toBe(45 * 60_000 - 100_000);
    expect(turnContext([], { now: 0, totalMs: 1, starter }).hasCode).toBe(false);
  });

  it("doesn't count lobby time before the start marker is stored", () => {
    const starter = starterCode(twoSum.signature, "python");
    const lobby: SessionEvent[] = [{ type: "snapshot", t: 0, payload: { code: starter, language: "python" } }];
    const early = turnContext(lobby, { now: 30 * 60_000, totalMs: 45 * 60_000, starter });
    expect(early.remainingMs).toBe(45 * 60_000);
    expect(early.sinceCandidateSpokeMs).toBe(0);
    const started = turnContext([...lobby, { type: "marker", t: 30 * 60_000, payload: { what: "start", detail: "livekit" } }], {
      now: 31 * 60_000,
      totalMs: 45 * 60_000,
      starter,
    });
    expect(started.remainingMs).toBe(44 * 60_000);
    expect(started.sinceCodeChangedMs).toBe(60_000);
  });

  it("computes recap stats", () => {
    const events: SessionEvent[] = [
      { type: "transcript", t: 5_000, payload: { speaker: "interviewer", text: "Hi", source: "interviewer" } },
      { type: "transcript", t: 20_000, payload: { speaker: "candidate", text: "Can it be empty?", source: "typed" } },
      { type: "run", t: 200_000, payload: { scope: "sample", verdict: "wrong_answer", passed: 1, total: 2, failingLabels: ["example"] } },
      { type: "transcript", t: 300_000, payload: { speaker: "candidate", text: "Fixed it", source: "browser-stt" } },
      { type: "run", t: 310_000, payload: { scope: "all", verdict: "accepted", passed: 9, total: 9, failingLabels: [] } },
    ];
    const s = sessionStats(events, 400_000);
    expect(s).toMatchObject({ candidateTurns: 2, interviewerTurns: 1, candidateWords: 6, runs: 2, failedRuns: 1, firstRunMs: 200_000, acceptedMs: 310_000, firstSpokeMs: 20_000 });
    expect(s.longestSilence).toEqual({ fromMs: 20_000, ms: 280_000 });
  });
});

describe("complexity parsing", () => {
  it("understands written and spoken complexities", () => {
    expect(spokenComplexity("It's O(n log n) because of the sort")).toBe("O(nlogn)");
    expect(spokenComplexity("o of n squared")).toBe("O(n^2)");
    expect(spokenComplexity("big O of n")).toBe("O(n)");
    expect(spokenComplexity("it runs in linear time")).toBe("O(n)");
    expect(spokenComplexity("constant space")).toBe("O(1)");
    expect(spokenComplexity("n log n")).toBe("O(nlogn)");
    expect(spokenComplexity("log n")).toBe("O(logn)");
    expect(spokenComplexity("I'm not sure")).toBeNull();
  });

  it("orders complexities against the optimal one", () => {
    expect(compareComplexity("O(n)", "O(n)")).toBe(0);
    expect(compareComplexity("O(n^2)", "O(n)")).toBe(1);
    expect(compareComplexity("O(logn)", "O(n)")).toBe(-1);
    expect(compareComplexity("O(nlogn)", "O(n log n)")).toBe(0);
    expect(compareComplexity("O(n)", "O(V + E)")).toBeNull();
  });
});

describe("scripted interviewer", () => {
  const starter = starterCode(twoSum.signature, "python");

  function run(steps: { kind: TurnKind; text?: string; events?: SessionEvent[]; now?: number }[], cfg = config) {
    let state: ScriptState = INITIAL_SCRIPT_STATE;
    const events: SessionEvent[] = [{ type: "marker", t: 0, payload: { what: "start", detail: "browser" } }, { type: "snapshot", t: 0, payload: { code: starter, language: "python" } }];
    const replies: string[] = [];
    let now = 0;
    for (const step of steps) {
      now = step.now ?? now + 30_000;
      events.push(...(step.events ?? []));
      const ctx = turnContext(events, { now, totalMs: cfg.minutes * 60_000, starter });
      const input: ScriptInput = { kind: step.kind, text: step.text, ctx, problem: twoSum, config: cfg };
      const out = scriptedTurn(state, input);
      state = out.state;
      replies.push(out.text);
    }
    return { replies, state };
  }

  it("walks the interview arc", () => {
    const { replies, state } = run([
      { kind: "start" },
      { kind: "utterance", text: "Can the array contain duplicates?" },
      { kind: "utterance", text: "I would use a hash map from value to index and look up the complement" },
      { kind: "utterance", text: "That's O(n) time and O(n) space" },
      { kind: "run", events: [{ type: "run", t: 200_000, payload: { scope: "all", verdict: "accepted", passed: 5, total: 5, failingLabels: [] } }] },
      { kind: "utterance", text: "linear time, linear space" },
      { kind: "utterance", text: "I'd stream it and keep the map" },
      { kind: "utterance", text: "Test empty input and negatives" },
      { kind: "utterance", text: "No questions, thanks" },
    ]);
    expect(replies[0]).toContain(twoSum.title);
    expect(replies[1]).toMatch(/duplicates/i);
    expect(replies[2]).toMatch(/complexity/i);
    expect(replies[3]).toMatch(/code it/i);
    expect(replies[4]).toMatch(/complexity/i);
    expect(replies[5]).toMatch(/^Right\. Follow-up/);
    expect(replies[6]).toMatch(/test/i);
    expect(replies[7]).toMatch(/questions for me/i);
    expect(replies[8]).toMatch(/End the interview/);
    expect(state.phase).toBe("done");
  });

  it("pushes back on a suboptimal approach once, then lets them code", () => {
    const { replies, state } = run([
      { kind: "start" },
      { kind: "utterance", text: "Brute force: two nested loops, O(n^2)" },
      { kind: "utterance", text: "I'll start with that" },
    ]);
    expect(replies[1]).toMatch(/do better/);
    expect(replies[2]).toMatch(/code it/);
    expect(state.phase).toBe("coding");
  });

  it("gives hints in order when allowed, and declines when not", () => {
    const allowed = run([{ kind: "start" }, { kind: "utterance", text: "I'm stuck, can I get a hint?" }, { kind: "utterance", text: "another hint please" }]);
    expect(allowed.replies[1]).toContain(twoSum.hints[0].replace(/[`*_]/g, "").slice(0, 20));
    expect(allowed.state.hintsGiven).toBe(2);
    const off = run([{ kind: "start" }, { kind: "utterance", text: "hint please" }], { ...config, hintsAllowed: false });
    expect(off.replies[1]).toMatch(/hints are off/i);
    expect(off.state.hintsGiven).toBe(0);
  });

  it("nudges on silence at most every 90 seconds", () => {
    const { replies } = run([
      { kind: "start", now: 0 },
      { kind: "silence", now: 60_000 },
      { kind: "silence", now: 100_000 },
      { kind: "silence", now: 200_000 },
    ]);
    expect(replies[1]).not.toBe(SILENT);
    expect(replies[2]).toBe(SILENT);
    expect(replies[3]).not.toBe(SILENT);
  });

  it("asks about a nested loop it sees in the code", () => {
    const code = "class Solution:\n    def two_sum(self, nums, target):\n        for i in range(len(nums)):\n            for j in range(i + 1, len(nums)):\n                pass";
    const { replies } = run([
      { kind: "start" },
      { kind: "utterance", text: "I'd use a hash map, O(n)" },
      { kind: "utterance", text: "okay writing it now", events: [{ type: "snapshot", t: 90_000, payload: { code, language: "python" } }] },
    ]);
    expect(replies[2]).toMatch(/nested loop/);
  });

  it("stays quiet on repeated identical test failures", () => {
    const fail: SessionEvent = { type: "run", t: 100_000, payload: { scope: "sample", verdict: "wrong_answer", passed: 0, total: 2, failingLabels: ["example"] } };
    const { replies } = run([{ kind: "start" }, { kind: "run", events: [fail] }, { kind: "run", events: [{ ...fail, t: 120_000 }] }]);
    expect(replies[1]).toMatch(/example case fails/);
    expect(replies[2]).not.toBe(SILENT); // a generic debugging prompt the first time
  });

  it("answers clarifying questions from the problem", () => {
    expect(answerClarifying("Are the values sorted?", twoSum)).toMatch(/don't assume it's sorted/);
    expect(answerClarifying("How big can the input be?", twoSum)).toContain(twoSum.constraints[0]);
  });

  it("detects nested loops by indentation", () => {
    expect(hasNestedLoop("for a in x:\n    for b in y:\n        pass")).toBe(true);
    expect(hasNestedLoop("for a in x:\n    pass\nfor b in y:\n    pass")).toBe(false);
    expect(hasNestedLoop("for (let i = 0; i < n; i++) {\n  while (j < i) j++;\n}")).toBe(true);
  });
});

describe("Claude interviewer prompt", () => {
  it("keeps the solution out of the candidate's view and the code in each turn", () => {
    const sys = systemPrompt(twoSum, config, { name: "Google", style: "AI-off algorithm rounds." });
    expect(sys).toContain(twoSum.statement);
    expect(sys).toContain("never read out verbatim");
    expect(sys).toContain("Company style: Google");
    expect(sys).toContain(SILENT);

    const starter = starterCode(twoSum.signature, "python");
    const ctx = turnContext([{ type: "marker", t: 0, payload: { what: "start", detail: "browser" } }, { type: "snapshot", t: 0, payload: { code: "x = 1", language: "python" } }], { now: 65_000, totalMs: 45 * 60_000, starter });
    const msg = turnMessage("utterance", "I think it's linear", ctx);
    expect(msg).toContain('Candidate said: "I think it\'s linear"');
    expect(msg).toContain("x = 1");
    expect(msg).toContain("1:05");
    expect(turnMessage("run", undefined, ctx)).toContain("[Event]");
  });

  it("rebuilds history so it starts with a user turn", () => {
    const h = historyMessages([
      { speaker: "interviewer", text: "Hi", t: 0 },
      { speaker: "candidate", text: "Hello", t: 1 },
    ]);
    expect(h.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });
});
