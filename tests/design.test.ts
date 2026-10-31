import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { gradeDesign } from "@/lib/design/grade";
import { describeDesign, summarizeScene, type SceneElement } from "@/lib/design/scene";
import { answerFact, designScripted, INITIAL_DESIGN_STATE, type DesignScriptState } from "@/lib/design/scripted";
import { DESIGN_TOPIC_BY_ID, DESIGN_TOPICS } from "@/lib/design/topics";
import type { ScriptContext } from "@/lib/rounds/kind";
import type { RoundConfig, Turn, TurnInput } from "@/lib/rounds/types";

const box = (id: string, label: string): SceneElement[] => [
  { id, type: "rectangle", boundElements: [{ id: `${id}-t`, type: "text" }] },
  { id: `${id}-t`, type: "text", text: label, containerId: id },
];
const arrow = (id: string, from: string, to: string, label?: string): SceneElement[] => [
  { id, type: "arrow", startBinding: { elementId: from }, endBinding: { elementId: to } },
  ...(label ? [{ id: `${id}-t`, type: "text", text: label, containerId: id }] : []),
];

const BOARD: SceneElement[] = [
  ...box("c", "Client"),
  ...box("lb", "Load balancer"),
  ...box("api", "API servers"),
  ...box("cache", "Redis cache"),
  ...box("db", "Key value database"),
  ...box("kgs", "Key generation service (counter ranges)"),
  ...arrow("a1", "c", "lb", "GET /abc123"),
  ...arrow("a2", "lb", "api"),
  ...arrow("a3", "api", "cache"),
  ...arrow("a4", "api", "db"),
  ...arrow("a5", "api", "kgs"),
  { id: "gone", type: "rectangle", isDeleted: true },
  { id: "free", type: "text", text: "~4k redirects/s" },
];

describe("whiteboard scene", () => {
  it("reads labelled boxes, arrows and free text, skipping deleted shapes", () => {
    const s = summarizeScene(BOARD);
    expect(s.components).toEqual(["Client", "Load balancer", "API servers", "Redis cache", "Key value database", "Key generation service (counter ranges)"]);
    expect(s.connections[0]).toEqual({ from: "Client", to: "Load balancer", label: "GET /abc123" });
    expect(s.connections).toHaveLength(5);
    expect(s.freeText).toEqual(["~4k redirects/s"]);
    expect(s.unlabelledShapes).toBe(0);
    const text = describeDesign({ elements: BOARD, notes: "100M links/month" });
    expect(text).toContain("[Redis cache]");
    expect(text).toContain("API servers -> Redis cache");
    expect(text).toContain("100M links/month");
  });

  it("says when the board is empty", () => {
    expect(describeDesign({ elements: [], notes: "" })).toContain("no labelled components");
  });
});

describe("design topics", () => {
  it("are complete", () => {
    expect(DESIGN_TOPICS.length).toBeGreaterThanOrEqual(8);
    for (const t of DESIGN_TOPICS) {
      expect(new Set(DESIGN_TOPICS.map((x) => x.id)).size).toBe(DESIGN_TOPICS.length);
      expect(t.facts.length).toBeGreaterThanOrEqual(5);
      expect(t.components.filter((c) => c.core).length).toBeGreaterThanOrEqual(3);
      expect(t.deepDives.length).toBeGreaterThanOrEqual(3);
      for (const d of t.deepDives) expect(d.keywords.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("answer clarifying questions from the brief", () => {
    const t = DESIGN_TOPIC_BY_ID.get("url-shortener")!;
    expect(answerFact(t, "How many users and how much traffic should I expect?")).toContain("100 million");
    expect(answerFact(t, "Do links ever expire?")).toContain("five years");
    expect(answerFact(t, "What's your favorite color?")).toBeNull();
  });
});

const config: RoundConfig = { minutes: 45, persona: "neutral", company: null, level: "mid" };

/** Drives the scripted interviewer through a conversation, like the engine does. */
function converse(topicId: string, says: string[], elements: SceneElement[] = [], minutes = 45) {
  let state: Record<string, unknown> = {};
  const transcript: Turn[] = [];
  const total = minutes * 60_000;
  const step = (input: TurnInput, t: number) => {
    if (input.kind === "say") transcript.push({ speaker: "candidate", text: input.text, t });
    const ctx: ScriptContext<{ elements: SceneElement[]; notes: string }> = {
      topicId,
      config: { ...config, minutes: minutes as RoundConfig["minutes"] },
      companyName: null,
      transcript,
      artifact: { elements, notes: "" },
      input,
      elapsedMs: t,
      remainingMs: total - t,
      state,
    };
    const r = designScripted(ctx);
    state = r.state;
    if (r.text !== "<silent>") transcript.push({ speaker: "interviewer", text: r.text, t: t + 1000 });
    return r.text;
  };
  const replies = [step({ kind: "start" }, 0)];
  says.forEach((text, i) => replies.push(step({ kind: "say", text, source: "typed" }, (i + 1) * 60_000)));
  return { replies, state: state as unknown as DesignScriptState, transcript };
}

describe("scripted design interviewer", () => {
  it("opens with the prompt, answers questions and walks the phases", () => {
    const { replies, state } = converse(
      "url-shortener",
      [
        "How many links are created per month?",
        "Okay, so the core features are creating a short link and redirecting.",
        "Do links expire?",
        "We need low latency redirects and high availability.",
        "I think that's enough requirements, let's move on.",
        "About 40 writes per second and 4000 reads per second, roughly 3 TB over five years.",
        "POST /links takes a long URL and returns a code; GET /{code} redirects.",
        "A table with code as the key and the long URL, in a key value store like DynamoDB.",
        "Here's the design on the board.",
        "A request goes from the client through the load balancer to the API, which checks the cache and then the database.",
      ],
      BOARD,
    );
    expect(replies[0]).toContain("link shortening service");
    expect(replies[1]).toContain("100 million");
    expect(replies[3]).toContain("five years");
    expect(replies.join(" ")).toContain("back-of-the-envelope");
    expect(replies.join(" ")).toContain("main API");
    expect(replies.join(" ")).toContain("data model");
    expect(replies.join(" ")).toContain("high-level design");
    expect(["high-level", "deep-dive"]).toContain(state.phase);
  });

  it("asks about missing core components it can't see on the board", () => {
    const { replies } = converse("url-shortener", ["Let's move on, ready to design.", "100 writes a second.", "POST and GET endpoints.", "A database table.", "Client to API servers.", "That's it.", "Still that."], [...box("c", "Client"), ...box("api", "API servers"), ...box("db", "Database")]);
    expect(replies.some((r) => r.includes("avoid hitting the database") || r.includes("generate a short code"))).toBe(true);
  });

  it("nudges after silence and wraps up on cue", () => {
    let s: Record<string, unknown> = { ...INITIAL_DESIGN_STATE };
    const base = { topicId: "chat", config, companyName: null, transcript: [] as Turn[], artifact: { elements: [], notes: "" }, elapsedMs: 600_000, remainingMs: 2_100_000 };
    const silent = designScripted({ ...base, input: { kind: "silence" }, state: s });
    expect(silent.text.length).toBeGreaterThan(5);
    const wrap = designScripted({ ...base, input: { kind: "wrap" }, state: (s = silent.state) });
    expect(wrap.text).toContain("summary");
    expect((wrap.state as unknown as DesignScriptState).phase).toBe("wrap");
    const again = designScripted({ ...base, input: { kind: "wrap" }, state: wrap.state });
    expect(again.text).toBe("<silent>");
  });

  it("skips ahead when the clock runs past a phase", () => {
    const { replies, state } = converse("rate-limiter", ["The limiter should limit per API key."], [], 20);
    // One minute into a 20-minute round is past the requirements share (15% = 3 min)? No: 1 min is 5%; keep requirements.
    expect(state.phase).toBe("requirements");
    const late = designScripted({
      topicId: "rate-limiter",
      config: { ...config, minutes: 20 },
      companyName: null,
      transcript: [{ speaker: "candidate", text: "Tokens refill each second.", t: 600_000 }],
      artifact: { elements: [], notes: "" },
      input: { kind: "say", text: "Tokens refill each second.", source: "typed" },
      elapsedMs: 600_000,
      remainingMs: 600_000,
      state: { ...INITIAL_DESIGN_STATE },
    });
    expect(late.text).toContain("keep moving");
    expect((late.state as unknown as DesignScriptState).phase).not.toBe("requirements");
    expect(replies).toHaveLength(2);
  });
});

describe("design grading", () => {
  const strong: Turn[] = [
    { speaker: "interviewer", text: "Design a link shortener.", t: 0 },
    { speaker: "candidate", text: "How many links per month, and what's the read to write ratio?", t: 20_000 },
    { speaker: "interviewer", text: "100 million a month, 100 to 1.", t: 30_000 },
    { speaker: "candidate", text: "Do links expire? And is latency important for redirects?", t: 60_000 },
    { speaker: "candidate", text: "So non-functional: low latency, high availability, and eventual consistency is fine.", t: 120_000 },
    { speaker: "candidate", text: "That's about 40 writes per second and 4,000 reads per second, and 6 billion records or 3 TB over five years.", t: 240_000 },
    { speaker: "candidate", text: "API: POST /links returns a code, GET /{code} returns a 302 redirect. The schema is a table keyed by code.", t: 400_000 },
    { speaker: "candidate", text: "Client hits a load balancer, stateless API servers check a Redis cache, then a key value store like DynamoDB partitioned by the code with consistent hashing and replication.", t: 700_000 },
    { speaker: "candidate", text: "For codes, each server gets a range of counter values from a key generation service and base62 encodes them, so there are no collisions and no lock per request, instead of hashing which needs collision checks.", t: 1_100_000 },
    { speaker: "candidate", text: "The redirect path is cache first, read through on a miss, LRU eviction with a TTL, and the CDN edge for hot links. I'd use 302 rather than 301 because we want click counts, the trade-off is more load.", t: 1_500_000 },
    { speaker: "candidate", text: "If a cache node fails we fall back to the database; replicas across regions handle a data center outage, and we monitor error rates with alerts.", t: 2_000_000 },
    { speaker: "candidate", text: "To summarize: counter ranges for codes, cache-heavy reads, a sharded key value store. The main trade-offs were 302 versus 301 and accuracy versus latency for click counts.", t: 2_500_000 },
  ];

  it("scores a strong round well and a silent one at the bottom", () => {
    const good = gradeDesign({ topicId: "url-shortener", config, companyName: null, transcript: strong, artifact: { elements: BOARD, notes: "" }, durationMs: 2_700_000 });
    expect(good.overall).toBeGreaterThanOrEqual(3);
    expect(["hire", "strong-hire", "lean-hire"]).toContain(good.hire.signal);
    expect(good.checks.find((c) => c.label.startsWith("Asked clarifying"))!.ok).toBe(true);
    expect(good.checks.find((c) => c.label.startsWith("Drew the design"))!.ok).toBe(true);
    const comps = (good.extra as { components: { name: string; status: string }[] }).components;
    expect(comps.find((c) => c.name === "Cache")!.status).toBe("board");

    const empty = gradeDesign({ topicId: "url-shortener", config, companyName: null, transcript: [strong[0]], artifact: { elements: [], notes: "" }, durationMs: 60_000 });
    expect(empty.overall).toBe(1);
    expect(["no", "strong-no"]).toContain(empty.hire.signal);
    expect(empty.focus.length).toBeGreaterThan(0);
  });
});

// The shared round engine against an embedded database, with the scripted interviewer.
describe("round engine", () => {
  beforeAll(() => {
    process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "rounds-db-"));
    delete process.env.ANTHROPIC_API_KEY;
  });

  async function setup() {
    const { db, schema, ensureMigrated } = await import("@/lib/db");
    const rounds = await import("@/lib/rounds");
    await ensureMigrated();
    const userId = `u-${Math.random().toString(36).slice(2)}`;
    await db.insert(schema.user).values({ id: userId, name: "T", email: `${userId}@x.dev` });
    await (await import("@/lib/privacy")).setRecordingConsent(userId, true);
    const id = await rounds.createRound(userId, "design", "url-shortener", { ...config, minutes: 30 });
    return { db, schema, rounds, id, userId };
  }

  const drain = async (g: AsyncGenerator<string>) => {
    let out = "";
    for await (const c of g) out += c;
    return out;
  };

  it("runs a round from Start to report", { timeout: 240_000 }, async () => {
    const { rounds, id, userId } = await setup();
    let round = (await rounds.getRound(id, userId))!;
    expect(round.startedAt).toBeNull();
    await expect(drain(rounds.runRoundTurn(round, { kind: "say", text: "hi", source: "typed" }))).rejects.toThrow("Press Start");
    const opening = await drain(rounds.runRoundTurn(round, { kind: "start" }));
    expect(opening).toContain("link shortening");
    round = (await rounds.getRound(id, userId))!;
    expect(round.startedAt).not.toBeNull();
    // A reload re-sends start; the interviewer doesn't open twice.
    expect(await drain(rounds.runRoundTurn(round, { kind: "start" }))).toBe("");

    await rounds.saveArtifact(round, { elements: BOARD, notes: "notes" });
    await expect(rounds.saveArtifact(round, { elements: "nope" })).rejects.toThrow();
    const reply = await drain(rounds.runRoundTurn(round, { kind: "say", text: "How many links a month?", source: "voice" }));
    expect(reply).toContain("100 million");

    round = (await rounds.getRound(id, userId))!;
    expect(round.transcript.map((t) => t.speaker)).toEqual(["interviewer", "candidate", "interviewer"]);
    expect(round.transcript[1]).toMatchObject({ text: "How many links a month?", source: "voice" });

    await rounds.finishRound(round, { elements: BOARD, notes: "final notes" });
    round = (await rounds.getRound(id, userId))!;
    expect(round.endedAt).not.toBeNull();
    expect((round.artifact as { notes: string }).notes).toBe("final notes");
    await expect(drain(rounds.runRoundTurn(round, { kind: "say", text: "more", source: "typed" }))).rejects.toThrow("ended");

    const report = await rounds.generateRoundReport(round);
    expect(report.generator).toBe("heuristic");
    expect(report.rubric.requirements.score).toBeGreaterThanOrEqual(1);
    expect((await rounds.getRound(id, userId))!.report).toEqual(report);
    expect((await rounds.listRounds(userId, "design")).map((r) => r.id)).toEqual([id]);
  });

  it("freezes the artifact after the time box and ends abandoned rounds", { timeout: 240_000 }, async () => {
    const { db, schema, rounds, id, userId } = await setup();
    const { eq } = await import("drizzle-orm");
    let round = (await rounds.getRound(id, userId))!;
    await drain(rounds.runRoundTurn(round, { kind: "start" }));
    // 33 minutes into a 30-minute round: past the grace period.
    await db.update(schema.rounds).set({ startedAt: new Date(Date.now() - 33 * 60_000) }).where(eq(schema.rounds.id, id));
    round = (await rounds.getRound(id, userId))!;
    expect(round.endedAt).toBeNull();
    await expect(rounds.saveArtifact(round, { elements: [], notes: "late" })).rejects.toThrow("Time's up");
    await rounds.finishRound(round, { elements: [], notes: "late" });
    expect(((await rounds.getRound(id, userId))!.artifact as { notes: string }).notes).toBe("");

    const other = await setup();
    let r2 = (await other.rounds.getRound(other.id, other.userId))!;
    await drain(other.rounds.runRoundTurn(r2, { kind: "start" }));
    await other.db.update(other.schema.rounds).set({ startedAt: new Date(Date.now() - 2 * 86_400_000) }).where(eq(other.schema.rounds.id, other.id));
    r2 = (await other.rounds.getRound(other.id, other.userId))!;
    expect(r2.endedAt).not.toBeNull();
  });
});
