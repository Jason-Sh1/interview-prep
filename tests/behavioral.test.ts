import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { behavioralKind } from "@/lib/behavioral";
import { describeBehavioral, summarizeStory, type BehavioralArtifact } from "@/lib/behavioral/artifact";
import { COMPETENCIES, COMPETENCY_IDS, suggestCompetencies } from "@/lib/behavioral/competencies";
import { coverageMatrix } from "@/lib/behavioral/coverage";
import { gradeBehavioral, segmentAnswers, type BehavioralExtra } from "@/lib/behavioral/grade";
import { COMPANY_PRINCIPLES } from "@/lib/behavioral/principles";
import { BEHAVIORAL_QUESTIONS, BEHAVIORAL_TOPICS, pickQuestions, QUESTION_BY_ID, questionCount } from "@/lib/behavioral/questions";
import { draftStoriesFromResume } from "@/lib/behavioral/resume";
import { behavioralScripted, INITIAL_BEHAVIORAL_STATE, PROBES, YOUR_QUESTIONS } from "@/lib/behavioral/scripted";
import { analyzeAnswer, checkStory, splitIntoStar } from "@/lib/behavioral/star";
import { COMPANIES } from "@/lib/engine/companies";
import type { ScriptContext } from "@/lib/rounds/kind";
import type { RoundConfig, Turn, TurnInput } from "@/lib/rounds/types";

const STRONG =
  "When I was at Acme on the payments team last year, our checkout service started timing out during peak traffic and we were losing orders. " +
  "My goal was to find the cause and fix it before Black Friday, three weeks away. First I profiled the service and traced the slow requests to a " +
  "database query without an index. I wrote a migration to add the index, tested it against a copy of production, and rolled it out behind a flag. " +
  "I also set up alerts on p99 latency and took ownership of the on-call runbook so the team would catch it earlier. As a result, p99 latency dropped from 2 seconds " +
  "to 200 ms and failed checkouts fell by 40%. I learned to add latency alerts whenever I ship a new query, and I now review query plans in code review.";
const WEAK = "We had a problem with the service and we fixed it as a team. It went fine in the end.";

const config: RoundConfig = { minutes: 30, persona: "neutral", company: "amazon", level: "mid" };

describe("bank data", () => {
  it("has about 40 questions, each well tagged", () => {
    expect(BEHAVIORAL_QUESTIONS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(BEHAVIORAL_QUESTIONS.map((q) => q.id)).size).toBe(BEHAVIORAL_QUESTIONS.length);
    const companies = new Set(COMPANIES.map((c) => c.id));
    for (const q of BEHAVIORAL_QUESTIONS) {
      expect(q.competencies.length).toBeGreaterThan(0);
      for (const c of q.competencies) expect(COMPETENCY_IDS).toContain(c);
      for (const c of q.companies) expect(companies).toContain(c);
      expect(q.probes.length).toBeGreaterThan(0);
    }
  });

  it("topics reference real questions and have enough for 45 minutes", () => {
    for (const t of BEHAVIORAL_TOPICS) {
      for (const id of t.questionIds) expect(QUESTION_BY_ID.has(id)).toBe(true);
      expect(t.questionIds.length).toBeGreaterThanOrEqual(questionCount(45));
    }
    expect(pickQuestions("general", 20, null)).toHaveLength(3);
    expect(pickQuestions("general", 30, null)).toHaveLength(4);
    expect(pickQuestions("general", 45, null)).toHaveLength(6);
    // A general set leans toward the chosen company's questions, keeping the opener.
    const amazon = pickQuestions("general", 30, "amazon");
    expect(amazon[0]).toBe("proudest");
    expect(amazon.slice(1).every((id) => QUESTION_BY_ID.get(id)!.companies.includes("amazon"))).toBe(true);
  });

  it("has all 16 Amazon leadership principles and principles for every company", () => {
    expect(COMPANY_PRINCIPLES.amazon.principles).toHaveLength(16);
    for (const c of COMPANIES) {
      const cp = COMPANY_PRINCIPLES[c.id];
      expect(cp, c.id).toBeDefined();
      for (const p of cp.principles) for (const comp of p.competencies) expect(COMPETENCY_IDS).toContain(comp);
    }
    expect(COMPETENCIES.length).toBeGreaterThanOrEqual(11);
  });
});

describe("STAR analysis", () => {
  it("finds every part, numbers, ownership and reflection in a strong answer", () => {
    const a = analyzeAnswer(STRONG, ["ownership", "quality"]);
    expect(a.parts).toEqual({ situation: true, task: true, action: true, result: true });
    expect(a.hasMetric).toBe(true);
    expect(a.iRatio).toBeGreaterThan(0.6);
    expect(a.actions).toBeGreaterThanOrEqual(3);
    expect(a.reflection).toBe(true);
    expect(a.length).toBe("ok");
    expect(a.relevance).toBeGreaterThanOrEqual(0.5);
    expect(a.score).toBe(4);
    expect(a.gaps).toEqual([]);
  });

  it("flags a short, team-only answer", () => {
    const a = analyzeAnswer(WEAK, ["ownership"]);
    expect(a.length).toBe("short");
    expect(a.parts.action).toBe(false);
    expect(a.iRatio).toBeLessThan(0.2);
    expect(a.hasMetric).toBe(false);
    expect(a.score).toBe(1);
    expect(a.gaps[0]).toBe("detail");
    expect(a.gaps).toContain("action");
    expect(a.gaps).toContain("reflection");
  });

  it("flags rambling and missing numbers", () => {
    const long = Array.from({ length: 30 }, () => "I talked to the team about the plan and we kept going with the work for a while longer.").join(" ") + " In the end it shipped.";
    const a = analyzeAnswer(long);
    expect(a.length).toBe("long");
    expect(a.gaps).toContain("rambling");
    expect(a.gaps).toContain("metric");
  });

  it("splits an answer into rough STAR fields", () => {
    const s = splitIntoStar(STRONG);
    expect(s.situation).toContain("Acme");
    expect(s.task).toContain("My goal");
    expect(s.action).toContain("I profiled");
    expect(s.result).toContain("40%");
    // "dropped" inside an "I did..." sentence is still an action.
    const t = splitIntoStar("Our retries were failing. I volunteered to own it. First I traced the failures to a queue that dropped messages. As a result failed charges fell by 30%.");
    expect(t.action).toContain("queue that dropped");
    expect(t.result).toBe("As a result failed charges fell by 30%.");
  });
});

describe("story checks", () => {
  it("passes a complete story and explains what a thin one is missing", () => {
    const good = {
      title: "Checkout timeouts before Black Friday",
      situation: "Last year at Acme, our checkout service started timing out at peak traffic and we were losing orders.",
      task: "I had to find the cause and fix it within three weeks.",
      action:
        "I profiled the service and traced the slow requests to a query without an index. I wrote the migration, tested it against a production copy, and rolled it out behind a flag. I set up p99 latency alerts.",
      result: "p99 latency dropped from 2 s to 200 ms and failed checkouts fell 40%. I now review query plans in code review.",
      competencies: ["ownership"],
    };
    expect(checkStory(good).filter((c) => !c.ok)).toEqual([]);
    const thin = checkStory({ title: "Migration", situation: "", task: "", action: "We migrated the service.", result: "It worked.", competencies: [] });
    const failing = thin.filter((c) => !c.ok).map((c) => c.id);
    expect(failing).toEqual(expect.arrayContaining(["situation", "task", "action", "first-person", "metric", "length", "competencies"]));
    expect(thin.find((c) => c.id === "metric")!.hint).toMatch(/measure/);
  });

  it("suggests competencies from the text", () => {
    expect(suggestCompetencies("I disagreed with my manager and pushed back, then we sat down with the data and found common ground.")).toContain("conflict");
    expect(suggestCompetencies("I mentored two interns and convinced three teams to adopt the new tool")).toContain("leadership");
  });
});

describe("resume drafting without Claude", () => {
  const RESUME = `Jane Doe
jane@example.com

EXPERIENCE
Software Engineer | Acme Corp | 2022 - Present
• Led the migration of the billing service to Kubernetes, reducing deploy time by 60%
• Built an internal alerting tool used by 12 teams
• Mentored three new engineers through onboarding and code reviews
Software Engineering Intern, Globex — Summer 2021
- Implemented a caching layer for the search API, cutting p99 latency from 800ms to 120ms
- Worked on stuff
EDUCATION
B.S. Computer Science, State University, 2022`;

  it("turns action-verb bullets into story seeds, metrics first", () => {
    const drafts = draftStoriesFromResume(RESUME);
    expect(drafts.length).toBe(4);
    const billing = drafts.find((d) => d.title.startsWith("Led the migration"))!;
    expect(billing.action).toBe("I led the migration of the billing service to Kubernetes.");
    expect(billing.result).toBe("Reducing deploy time by 60%.");
    expect(billing.situation).toBe("Role: Software Engineer, Acme Corp.");
    const cache = drafts.find((d) => d.title.startsWith("Implemented"))!;
    expect(cache.result).toContain("800ms to 120ms");
    expect(cache.situation).toBe("Role: Software Engineering Intern, Globex.");
    // A bullet with a number but no result clause leaves the result for you to write.
    expect(drafts.find((d) => d.title.startsWith("Built"))!.result).toBe("");
    // Bullets with numbers come before the one without.
    expect(drafts.at(-1)!.title).toMatch(/^Mentored/);
    expect(drafts.at(-1)!.competencies).toContain("leadership");
    expect(drafts.some((d) => /stuff/.test(d.title))).toBe(false);
  });

  it("handles PDF-style text with inline bullets and empty input", () => {
    const flat = "Acme Corp, Engineer 2020 • Designed a new onboarding flow that increased activation by 15% • Wrote docs";
    const drafts = draftStoriesFromResume(flat);
    expect(drafts.map((d) => d.title)).toEqual(["Designed a new onboarding flow"]);
    expect(drafts[0].result).toContain("15%");
    expect(draftStoriesFromResume("")).toEqual([]);
  });
});

describe("coverage matrix", () => {
  const story = (id: number, competencies: string[], text = "") => ({ id, title: `S${id}`, situation: text, task: "", action: "", result: "", competencies });

  it("maps stories to a company's principles and calls out gaps", () => {
    const cov = coverageMatrix([story(1, ["ownership", "impact"]), story(2, ["customer"]), story(3, ["ownership"])], "amazon");
    expect(cov.principles).toHaveLength(16);
    expect(cov.principles.find((p) => p.id === "ownership")!.stories).toEqual([1, 3]);
    expect(cov.principles.find((p) => p.id === "customer-obsession")!.stories).toEqual([2]);
    expect(cov.gaps).toContain("Invent and Simplify");
    expect(cov.gaps).not.toContain("Ownership");
    expect(cov.thin).toContain("Customer Obsession");
  });

  it("uses competencies with no company, guessing tags for untagged stories", () => {
    const cov = coverageMatrix([story(1, [], "I disagreed with a teammate and we found common ground after a one-on-one.")], null);
    expect(cov.principles).toEqual([]);
    expect(cov.competencies.find((c) => c.id === "conflict")!.stories).toEqual([1]);
    expect(cov.gaps).toContain("Ownership");
  });
});

// The scripted interviewer, turn by turn.
const ARTIFACT: BehavioralArtifact = {
  questionIds: ["own-beyond-role", "customer-need", "disagree-commit"],
  stories: [{ id: 1, title: "Checkout timeouts", summary: summarizeStory({ situation: "Peak traffic", task: "", action: "I added an index", result: "40% fewer failures" }), competencies: ["ownership"] }],
  notes: "",
};

function runner(minutes = 30) {
  let state: Record<string, unknown> = {};
  const transcript: Turn[] = [];
  let t = 0;
  return {
    transcript,
    get state() {
      return state as unknown as typeof INITIAL_BEHAVIORAL_STATE;
    },
    turn(input: TurnInput, at?: number) {
      t = at ?? t + 60_000;
      if (input.kind === "say") transcript.push({ speaker: "candidate", text: input.text, t, source: "typed" });
      const ctx: ScriptContext<BehavioralArtifact> = {
        topicId: "amazon-lp",
        config: { ...config, minutes: minutes as RoundConfig["minutes"] },
        companyName: "Amazon",
        transcript: [...transcript],
        artifact: ARTIFACT,
        input,
        elapsedMs: t,
        remainingMs: minutes * 60_000 - t,
        state,
      };
      const r = behavioralScripted(ctx);
      state = r.state;
      if (r.text !== "<silent>") transcript.push({ speaker: "interviewer", text: r.text, t });
      return r.text;
    },
  };
}
const say = (text: string): TurnInput => ({ kind: "say", text, source: "typed" });
const allProbes = Object.values(PROBES).flat();

describe("scripted behavioral interviewer", () => {
  it("asks the questions in order, probes gaps, then asks for questions and closes", () => {
    const r = runner();
    const open = r.turn({ kind: "start" }, 0);
    expect(open).toContain("behavioral round");
    expect(open).toContain("3 situations");
    expect(open).toContain(QUESTION_BY_ID.get("own-beyond-role")!.text);

    // A clarifying question doesn't use up a probe.
    expect(r.turn(say("Does it have to be from work?"))).toMatch(/Any example works/);
    expect(r.state.probes).toEqual([]);

    // A weak answer gets two STAR probes, then the interviewer moves on.
    const p1 = r.turn(say(WEAK));
    expect(allProbes).toContain(p1);
    expect(PROBES.situation).toContain(p1);
    const p2 = r.turn(say("We were behind on a launch. We worked late."));
    expect(allProbes).toContain(p2);
    expect(p2).not.toBe(p1);
    const q2 = r.turn(say("I don't remember more than that."));
    expect(q2).toContain(QUESTION_BY_ID.get("customer-need")!.text);
    expect(r.state.q).toBe(1);

    // A complete answer gets one question-specific follow-up, then the next question.
    const f = r.turn(say(STRONG));
    expect(QUESTION_BY_ID.get("customer-need")!.probes.some((p) => f.includes(p))).toBe(true);
    const q3 = r.turn(say("I measured it with the support ticket volume, which fell by half, and I checked in with the customer every week."));
    expect(q3).toContain(QUESTION_BY_ID.get("disagree-commit")!.text);

    // Silence: one nudge per question.
    expect(r.turn({ kind: "silence" })).toMatch(/Take a moment/);
    expect(r.turn({ kind: "silence" })).toBe("<silent>");

    r.turn(say(STRONG));
    const end = r.turn(say(STRONG + " I would do it the same way again."));
    expect(end).toContain(YOUR_QUESTIONS);
    expect(r.state.phase).toBe("your-questions");
    const close = r.turn(say("What does a typical week look like on the team?"));
    expect(close).toMatch(/Good question.*Press End/);
    expect(r.state.phase).toBe("closed");
    expect(r.turn(say("Thanks!"))).toMatch(/out of time/);
  });

  it("keeps to the clock: no probes when behind, and wraps up on the wrap event", () => {
    const r = runner(20);
    r.turn({ kind: "start" }, 0);
    // 9 minutes into a 20-minute round on question 1: no time for probes.
    const next = r.turn(say(WEAK), 9 * 60_000);
    expect(next).toContain(QUESTION_BY_ID.get("customer-need")!.text);
    const wrap = r.turn({ kind: "wrap" }, 17 * 60_000);
    expect(wrap).toContain("nearly out of time");
    expect(wrap).toContain(YOUR_QUESTIONS);
    expect(r.turn({ kind: "wrap" })).toBe("<silent>");
    expect(r.turn(say("No, I'm good, thanks."))).toMatch(/No problem/);
  });

  it("describes the artifact with stories and questions for Claude", () => {
    const text = describeBehavioral(ARTIFACT);
    expect(text).toContain("Checkout timeouts");
    expect(text).toContain("[Ownership]");
    expect(text).toContain("1. Tell me about a time you took on");
    expect(describeBehavioral({ ...ARTIFACT, stories: [] })).toContain("no stories");
    const prompt = behavioralKind.systemPrompt("amazon-lp", config, { name: "Amazon", style: "x" });
    expect(prompt).toContain("Customer Obsession");
    expect(prompt).toContain("<silent>");
  });
});

describe("behavioral grading", () => {
  function transcriptFor(answers: string[], askBack = true): Turn[] {
    const qs = ARTIFACT.questionIds.map((id) => QUESTION_BY_ID.get(id)!);
    const t: Turn[] = [];
    let at = 0;
    qs.forEach((q, i) => {
      t.push({ speaker: "interviewer", text: `${i ? "Next question." : "Hi."} ${q.text}`, t: (at += 30_000) });
      t.push({ speaker: "candidate", text: answers[i], t: (at += 120_000) });
      t.push({ speaker: "interviewer", text: PROBES.reflect[0], t: (at += 5_000) });
      t.push({ speaker: "candidate", text: "I'd plan more carefully.", t: (at += 20_000) });
    });
    t.push({ speaker: "interviewer", text: YOUR_QUESTIONS, t: (at += 10_000) });
    if (askBack) t.push({ speaker: "candidate", text: "What's the on-call like?", t: (at += 10_000) });
    return t;
  }
  const grade = (transcript: Turn[]) => gradeBehavioral({ topicId: "amazon-lp", config, companyName: "Amazon", transcript, artifact: ARTIFACT, durationMs: 25 * 60_000 });

  it("segments answers by question, including paraphrased questions", () => {
    const segs = segmentAnswers(transcriptFor([STRONG, WEAK, STRONG]), ARTIFACT.questionIds.map((id) => QUESTION_BY_ID.get(id)!));
    expect(segs.map((s) => s.followUps)).toEqual([1, 1, 1]);
    expect(segs[1].answer).toContain("We had a problem");
    expect(segs[1].answer).toContain("plan more carefully");
    const para: Turn[] = [
      { speaker: "interviewer", text: "So, can you tell me about a decision you disagreed with but went along with anyway, and how you handled it?", t: 1 },
      { speaker: "candidate", text: "Sure.", t: 2 },
    ];
    expect(segmentAnswers(para, [QUESTION_BY_ID.get("disagree-commit")!])[0].t).toBe(1);
  });

  it("scores strong answers above weak ones, with per-question results and principles", () => {
    const strong = grade(transcriptFor([STRONG, STRONG, STRONG]));
    const weak = grade(transcriptFor([WEAK, WEAK, WEAK], false));
    expect(strong.overall).toBeGreaterThan(weak.overall + 1);
    expect(["hire", "strong-hire"]).toContain(strong.hire.signal);
    expect(["no", "strong-no"]).toContain(weak.hire.signal);
    expect(strong.rubric.structure.score).toBe(4);
    expect(weak.rubric.ownership.score).toBeLessThanOrEqual(2);
    expect(weak.focus.length).toBeGreaterThan(0);
    const x = strong.extra as unknown as BehavioralExtra;
    expect(x.questions).toHaveLength(3);
    expect(x.questions[0].star!.parts.result).toBe(true);
    expect(x.questions[0].principles).toContain("Ownership");
    expect(x.principles.find((p) => p.name === "Ownership")!.shown).toBe(true);
    expect(strong.checks.find((c) => c.label === "Asked the interviewer a question")!.ok).toBe(true);
    expect(weak.checks.find((c) => c.label === "Asked the interviewer a question")!.ok).toBe(false);
    expect(weak.checks.find((c) => c.label === "Put numbers on results")!.ok).toBe(false);
    expect(weak.moments.some((m) => m.tone === "info")).toBe(true);
  });

  it("handles an empty round and unreached questions", () => {
    const empty = grade([]);
    expect(empty.summary).toMatch(/before you said anything/);
    expect((empty.extra as unknown as BehavioralExtra).questions.every((q) => q.t === null)).toBe(true);
    const one = grade(transcriptFor([STRONG, STRONG, STRONG]).slice(0, 4));
    const x = one.extra as unknown as BehavioralExtra;
    expect(x.questions[0].t).not.toBeNull();
    expect(x.questions[1].t).toBeNull();
    expect(one.hire.signal).toBe("no");
    // Two strong answers, then ending 5 minutes into 30 with a question left: capped at lean hire.
    const early = gradeBehavioral({ topicId: "amazon-lp", config, companyName: "Amazon", transcript: transcriptFor([STRONG, STRONG, STRONG]).slice(0, 8), artifact: ARTIFACT, durationMs: 5 * 60_000 });
    expect(early.hire.signal).toBe("lean-hire");
    expect(early.hire.reasons.join(" ")).toMatch(/Ended early/);
    expect(early.checks.find((c) => c.label === "Got through every question")!.ok).toBe(false);
  });
});

// The shared round engine with the behavioral kind, against an embedded database.
describe("behavioral rounds in the engine", () => {
  beforeAll(() => {
    process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "behavioral-db-"));
    delete process.env.ANTHROPIC_API_KEY;
  });

  const drain = async (g: AsyncGenerator<string>) => {
    let out = "";
    for await (const c of g) out += c;
    return out;
  };

  it("runs a round with the story bank from Start to report", { timeout: 240_000 }, async () => {
    const { db, schema, ensureMigrated } = await import("@/lib/db");
    const rounds = await import("@/lib/rounds");
    const stories = await import("@/lib/behavioral/stories");
    await ensureMigrated();
    const userId = `u-${Math.random().toString(36).slice(2)}`;
    await db.insert(schema.user).values({ id: userId, name: "T", email: `${userId}@x.dev` });

    await stories.saveResume(userId, "Software Engineer | Acme | 2022 - Present\n- Led the migration of billing to Kubernetes, reducing deploy time by 60%\n- Built an alerting tool used by 12 teams", null);
    const { drafts, generator } = await stories.draftFromResume((await stories.getResume(userId))!.text);
    expect(generator).toBe("heuristic");
    expect(await stories.addDrafts(userId, drafts)).toBe(2);
    expect(await stories.addDrafts(userId, drafts)).toBe(0);
    const bank = await stories.listStories(userId);
    expect(bank.map((s) => s.origin)).toEqual(["resume", "resume"]);
    await stories.updateStory(userId, bank[0].id, { ...bank[0], competencies: ["ownership", "impact"] } as never);
    await stories.deleteStory(userId, bank[1].id);
    expect((await stories.listStories(userId)).map((s) => s.competencies)).toEqual([["ownership", "impact"]]);

    const artifact = await stories.behavioralStartArtifact(userId, "amazon-lp", 20, "amazon");
    expect(artifact.questionIds).toHaveLength(3);
    expect(artifact.stories[0].title).toMatch(/^Led the migration/);
    const id = await rounds.createRound(userId, "behavioral", "amazon-lp", { ...config, minutes: 20 }, artifact);
    let round = (await rounds.getRound(id, userId))!;
    const opening = await drain(rounds.runRoundTurn(round, { kind: "start" }));
    expect(opening).toContain(QUESTION_BY_ID.get(artifact.questionIds[0])!.text);
    round = (await rounds.getRound(id, userId))!;
    const probe = await drain(rounds.runRoundTurn(round, say(WEAK)));
    expect(allProbes).toContain(probe);
    round = (await rounds.getRound(id, userId))!;
    await drain(rounds.runRoundTurn(round, say(STRONG)));

    await rounds.finishRound(round, { ...artifact, notes: "use the billing story" });
    round = (await rounds.getRound(id, userId))!;
    expect((round.artifact as BehavioralArtifact).notes).toBe("use the billing story");
    const report = await rounds.generateRoundReport(round);
    expect(report.generator).toBe("heuristic");
    const x = report.extra as unknown as BehavioralExtra;
    expect(x.questions[0].answer).toContain("We had a problem");
    // The full answer after one probe moves the interviewer on to question 2.
    expect(x.questions[1].t).not.toBeNull();
    expect(x.questions[2].t).toBeNull();
    expect((await rounds.listRounds(userId, "behavioral")).map((r) => r.id)).toEqual([id]);
  });
});
