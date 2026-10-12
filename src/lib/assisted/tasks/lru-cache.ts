import type { AssistedTask } from "../types";
import { fence } from "./util";

const LRU_STARTER = String.raw`// Least-recently-used cache. Both get() and set() count as a use; when the
// cache is full, set() evicts the entry that was used longest ago.
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    // A Map iterates in insertion order, so the first key is the oldest.
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    return this.map.get(key);
  }

  set(key, value) {
    if (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
    this.map.set(key, value);
  }

  delete(key) {
    return this.map.delete(key);
  }

  get size() {
    return this.map.size;
  }
}

module.exports = { LRUCache };
`;

const LRU_CLASS = String.raw`class LRUCache {
  constructor(capacity, { ttlMs = Infinity, now = Date.now } = {}) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.now = now;
    // A Map iterates in insertion order, so the first key is the oldest.
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (this.now() - entry.at >= this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    // Move to the newest position.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) this.map.delete(this.map.keys().next().value);
    this.map.set(key, { value, at: this.now() });
  }

  delete(key) {
    return this.map.delete(key);
  }

  get size() {
    return this.map.size;
  }
}`;

const LRU_REFERENCE = String.raw`// Least-recently-used cache. Both get() and set() count as a use; when the
// cache is full, set() evicts the entry that was used longest ago.
// With ttlMs, an entry expires ttlMs after it was last set.
` + LRU_CLASS + "\n\nmodule.exports = { LRUCache };\n";

const SERVICE_STARTER = String.raw`// Profile lookups, cached in front of the slow profile store.
const { LRUCache } = require("./lru");

function createProfileService({ fetchProfile, capacity = 100 }) {
  const cache = new LRUCache(capacity);
  return {
    getProfile(id) {
      const hit = cache.get(id);
      if (hit !== undefined) return hit;
      const profile = fetchProfile(id);
      cache.set(id, profile);
      return profile;
    },
    updateProfile(id, profile) {
      cache.set(id, profile);
    },
  };
}

module.exports = { createProfileService };
`;

const SERVICE_REFERENCE = String.raw`// Profile lookups, cached in front of the slow profile store.
const { LRUCache } = require("./lru");

function createProfileService({ fetchProfile, capacity = 100, ttlMs = 5 * 60 * 1000, now = Date.now }) {
  const cache = new LRUCache(capacity, { ttlMs, now });
  return {
    getProfile(id) {
      const hit = cache.get(id);
      if (hit !== undefined) return hit;
      const profile = fetchProfile(id);
      cache.set(id, profile);
      return profile;
    },
    updateProfile(id, profile) {
      cache.set(id, profile);
    },
  };
}

module.exports = { createProfileService };
`;

const VISIBLE_TESTS = String.raw`const { LRUCache } = require("../src/lru");

test("stores and returns values", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  expect(c.get("a")).toBe(1);
  expect(c.get("missing")).toBeUndefined();
});

test("evicts the least recently used entry", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  c.set("b", 2);
  c.get("a"); // a is now the most recently used
  c.set("c", 3);
  expect(c.get("b")).toBeUndefined();
  expect(c.get("a")).toBe(1);
  expect(c.get("c")).toBe(3);
});

test("updating a key at capacity doesn't evict anything", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  c.set("b", 2);
  c.set("b", 20);
  expect(c.size).toBe(2);
  expect(c.get("a")).toBe(1);
  expect(c.get("b")).toBe(20);
});
`;

const HIDDEN_TESTS = String.raw`const { LRUCache } = require("../src/lru");
const { createProfileService } = require("../src/profileService");

function fakeClock() {
  let t = 0;
  const now = () => t;
  now.advance = (ms) => { t += ms; };
  return now;
}

test("updating a key makes it the most recently used", () => {
  const c = new LRUCache(2);
  c.set("a", 1);
  c.set("b", 2);
  c.set("a", 10);
  c.set("c", 3);
  expect(c.get("b")).toBeUndefined();
  expect(c.get("a")).toBe(10);
});

test("entries expire exactly ttlMs after they were set", () => {
  const now = fakeClock();
  const c = new LRUCache(10, { ttlMs: 1000, now });
  c.set("a", 1);
  now.advance(999);
  expect(c.get("a")).toBe(1);
  now.advance(1);
  expect(c.get("a")).toBeUndefined();
  expect(c.size).toBe(0);
});

test("reading an entry doesn't extend its lifetime", () => {
  const now = fakeClock();
  const c = new LRUCache(10, { ttlMs: 1000, now });
  c.set("a", 1);
  now.advance(600);
  expect(c.get("a")).toBe(1);
  now.advance(600);
  expect(c.get("a")).toBeUndefined();
});

test("setting again restarts the lifetime", () => {
  const now = fakeClock();
  const c = new LRUCache(10, { ttlMs: 1000, now });
  c.set("a", 1);
  now.advance(800);
  c.set("a", 2);
  now.advance(800);
  expect(c.get("a")).toBe(2);
});

test("without ttlMs nothing expires", () => {
  const now = fakeClock();
  const c = new LRUCache(10, { now });
  c.set("a", 1);
  now.advance(1e12);
  expect(c.get("a")).toBe(1);
});

test("the profile service refetches after five minutes", () => {
  const now = fakeClock();
  let calls = 0;
  const svc = createProfileService({ fetchProfile: (id) => ({ id, n: ++calls }), now });
  expect(svc.getProfile("u1").n).toBe(1);
  now.advance(4 * 60 * 1000);
  expect(svc.getProfile("u1").n).toBe(1);
  now.advance(60 * 1000);
  expect(svc.getProfile("u1").n).toBe(2);
});

test("hot profiles stay cached under churn", () => {
  let calls = 0;
  const svc = createProfileService({ fetchProfile: (id) => ({ id, n: ++calls }), capacity: 3 });
  svc.getProfile("hot");
  for (let i = 0; i < 10; i++) {
    svc.getProfile("hot");
    svc.getProfile("cold" + i);
  }
  expect(svc.getProfile("hot").n).toBe(1);
});
`;

const fixReply = (cls: string) =>
  `There are three bugs in \`src/lru.js\`:\n\n1. \`get\` never refreshes recency, so a hot key is evicted as if it were never used.\n2. \`set\` evicts whenever the map is full, even when the key is already there, so updating a key at capacity throws out another entry.\n3. \`Map.set\` on an existing key keeps its old position, so an update doesn't count as a use.\n\nHere's the class with all three fixed, plus the TTL option (entries expire \`ttlMs\` after they were last set):\n\n${fence(cls)}\n\nThen pass \`ttlMs\` and \`now\` through from \`createProfileService\` (default five minutes).`;

export const lruTask: AssistedTask = {
  id: "lru-cache",
  title: "Debug a profile cache and add expiry",
  summary: "Find and fix the bugs behind stale and evicted profiles in an LRU cache, then add a TTL.",
  modeledOn: "Google's code-comprehension pilot and \"debug this code\" rounds: read unfamiliar code, explain it, fix it.",
  entry: "src/lru.js",
  brief: `On-call reports two problems with the profile service: hot profiles keep getting evicted from the cache, and profiles are never refreshed after an edit made elsewhere.

- \`src/lru.js\` is supposed to be a least-recently-used cache, but it has bugs. Two of the visible tests fail. Find and fix every bug, not only the ones the tests catch.
- Add expiry: \`new LRUCache(capacity, { ttlMs, now })\`. An entry expires exactly \`ttlMs\` after it was last **set** (reading it doesn't extend its life). An expired entry reads as \`undefined\` and is removed. Without \`ttlMs\`, nothing expires. \`now\` defaults to \`Date.now\`.
- \`createProfileService\` should cache profiles for five minutes by default, and accept \`ttlMs\` and \`now\` options.

Use the assistant however you like, but you must paste or type its code yourself, and its answers can be wrong, as real ones are. Run the tests often. When you finish, you'll explain what was wrong and how you fixed it.`,
  files: {
    "src/lru.js": LRU_STARTER,
    "src/profileService.js": SERVICE_STARTER,
    "tests/lru.test.js": VISIBLE_TESTS,
  },
  visibleTests: ["tests/lru.test.js"],
  hiddenTests: { "tests/grading.test.js": HIDDEN_TESTS },
  reference: {
    "src/lru.js": LRU_REFERENCE,
    "src/profileService.js": SERVICE_REFERENCE,
    "tests/lru.test.js": VISIBLE_TESTS,
  },
  requirements: [
    { label: "the eviction bugs", keywords: ["evict", "recency", "recently", "bug", "fix"] },
    { label: "expiry", keywords: ["ttl", "expire", "expiry"] },
    { label: "the profile service", keywords: ["profile", "service"] },
  ],
  bugs: [
    {
      id: "ttl-off-by-one",
      description: "Entries expired one millisecond late: the age check used `>` instead of `>=`.",
      signature: String.raw`this\.now\(\)\s*-\s*entry\.at\s*>(?!=)\s*this\.ttlMs`,
      mutate: { path: "src/lru.js", from: "this.now() - entry.at >= this.ttlMs", to: "this.now() - entry.at > this.ttlMs" },
    },
    {
      id: "ttl-refreshed-on-read",
      description: "get() stamped the entry with the current time, so reading a profile kept it alive forever instead of expiring after it was set.",
      signature: String.raw`value:\s*entry\.value,\s*at:\s*this\.now\(\)`,
      mutate: { path: "src/lru.js", from: "this.map.set(key, entry);", to: "this.map.set(key, { value: entry.value, at: this.now() });" },
    },
  ],
  topics: [
    {
      id: "fix",
      keywords: ["bug", "fix", "lru", "evict", "wrong", "broken", "fail", "ttl", "expire", "expiry", "cache"],
      reply: fixReply(LRU_CLASS),
      buggy: [
        { bug: "ttl-off-by-one", reply: fixReply(LRU_CLASS.replace("this.now() - entry.at >= this.ttlMs", "this.now() - entry.at > this.ttlMs")) },
        {
          bug: "ttl-refreshed-on-read",
          reply: fixReply(LRU_CLASS.replace("this.map.set(key, entry);", "this.map.set(key, { value: entry.value, at: this.now() });")),
        },
      ],
    },
    {
      id: "service",
      keywords: ["profileservice", "profile service", "createprofileservice", "five minutes", "5 minutes", "default"],
      reply: `Pass the options through and default to five minutes:\n\n${fence(String.raw`function createProfileService({ fetchProfile, capacity = 100, ttlMs = 5 * 60 * 1000, now = Date.now }) {
  const cache = new LRUCache(capacity, { ttlMs, now });
  // ...getProfile and updateProfile stay the same
}`)}`,
    },
    {
      id: "explain",
      keywords: ["explain", "what does", "how does", "overview", "walk me", "structure", "codebase", "understand"],
      reply: `How it fits together:\n\n- \`src/lru.js\` keeps entries in a \`Map\`. A \`Map\` remembers insertion order, so the first key is the oldest, and the trick for "touching" a key is to delete and re-insert it.\n- \`src/profileService.js\` checks the cache first and falls back to \`fetchProfile\`. \`updateProfile\` writes through to the cache.\n- The failing tests are about recency: what counts as a use, and what happens when you update a key while the cache is full.`,
    },
    {
      id: "tests",
      keywords: ["test", "edge case", "verify", "check my"],
      reply: `Cases worth covering:\n\n- Updating an existing key at capacity evicts nothing, and makes that key the newest.\n- A read moves a key to the newest position.\n- Expiry at exactly \`ttlMs\` (use a fake clock), a read not extending the lifetime, and a re-set restarting it.\n- No \`ttlMs\` means no expiry.\n- Through the service: a hot profile read in between many cold ones stays cached.`,
    },
  ],
};
