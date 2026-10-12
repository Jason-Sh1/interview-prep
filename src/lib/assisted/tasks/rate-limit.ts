import type { AssistedTask } from "../types";
import { fence } from "./util";

const CONFIG = String.raw`// Settings for the messages API.
module.exports = {
  rateLimit: {
    // Each client may make at most max requests in any windowMs window.
    windowMs: 60000,
    max: 5,
  },
  maxMessageLength: 280,
};
`;

const STORE = String.raw`// In-memory message store.
function createStore() {
  const messages = [];
  let nextId = 1;
  return {
    list() {
      return messages.slice();
    },
    add(author, text) {
      const msg = { id: nextId++, author, text };
      messages.push(msg);
      return msg;
    },
  };
}

module.exports = { createStore };
`;

const APP = String.raw`// Wires the pieces together. Tests call createApp({ now }) with a fake clock.
const config = require("../config");
const { createStore } = require("./store");
const { createRateLimiter } = require("./rateLimiter");
const { createHandler } = require("./handler");

function createApp({ now } = {}) {
  const limiter = createRateLimiter({ ...config.rateLimit, now });
  return createHandler({ store: createStore(), limiter });
}

module.exports = { createApp };
`;

const LIMITER_DOC = String.raw`// Sliding-window rate limiter.
//
// createRateLimiter({ windowMs, max, now }) returns { check(key) }.
// check(key) records a request for key and returns
//   { allowed: true, remaining }      when the request is allowed, or
//   { allowed: false, retryAfterMs }  when the client is over the limit.
// A request counts against the limit for windowMs milliseconds after it is
// made. Rejected requests don't count. now() returns the time in ms (tests
// pass a fake clock).
`;

const LIMITER_STARTER = LIMITER_DOC + String.raw`
function createRateLimiter({ windowMs, max, now = Date.now }) {
  // TODO: implement the limiter described above.
  return {
    check(key) {
      return { allowed: true, remaining: max };
    },
  };
}

module.exports = { createRateLimiter };
`;

const LIMITER_BODY = String.raw`function createRateLimiter({ windowMs, max, now = Date.now }) {
  // key -> times of allowed requests still inside the window, oldest first
  const hits = new Map();
  return {
    check(key) {
      const t = now();
      const recent = (hits.get(key) || []).filter((ts) => t - ts < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return { allowed: false, retryAfterMs: recent[0] + windowMs - t };
      }
      recent.push(t);
      hits.set(key, recent);
      return { allowed: true, remaining: max - recent.length };
    },
  };
}`;

const LIMITER_REFERENCE = LIMITER_DOC + "\n" + LIMITER_BODY + "\n\nmodule.exports = { createRateLimiter };\n";

const HANDLER_HEAD = String.raw`// HTTP-style handler for the messages API.
// handle(req) takes { method, path, headers, body } and returns
// { status, headers, body }.
const config = require("../config");

function createHandler({ store, limiter }) {
  function route(req) {
    if (req.method === "GET" && req.path === "/messages") {
      return { status: 200, headers: {}, body: { messages: store.list() } };
    }
    if (req.method === "POST" && req.path === "/messages") {
      const text = req.body && typeof req.body.text === "string" ? req.body.text.trim() : "";
      if (!text) return { status: 400, headers: {}, body: { error: "text is required" } };
      if (text.length > config.maxMessageLength) {
        return { status: 400, headers: {}, body: { error: "text is too long" } };
      }
      const author = req.headers["x-client-id"] || "anonymous";
      return { status: 201, headers: {}, body: store.add(author, text) };
    }
    return { status: 404, headers: {}, body: { error: "not found" } };
  }
`;

const HANDLER_STARTER =
  HANDLER_HEAD +
  String.raw`
  return function handle(req) {
    // TODO: rate limit every request per client (the x-client-id header, or
    // "anonymous"). Over the limit: 429 with a Retry-After header in whole
    // seconds. Allowed: add an X-RateLimit-Remaining header.
    return route(req);
  };
}

module.exports = { createHandler };
`;

const HANDLE_BODY = String.raw`  return function handle(req) {
    const client = req.headers["x-client-id"] || "anonymous";
    const verdict = limiter.check(client);
    if (!verdict.allowed) {
      return {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(verdict.retryAfterMs / 1000)) },
        body: { error: "rate limit exceeded" },
      };
    }
    const res = route(req);
    res.headers["X-RateLimit-Remaining"] = String(verdict.remaining);
    return res;
  };`;

const HANDLER_REFERENCE = HANDLER_HEAD + "\n" + HANDLE_BODY + "\n}\n\nmodule.exports = { createHandler };\n";

const VISIBLE_TESTS = String.raw`const { createApp } = require("../src/app");

function fakeClock() {
  let t = 0;
  const now = () => t;
  now.advance = (ms) => { t += ms; };
  return now;
}
const post = (handle, client, text = "hi") =>
  handle({ method: "POST", path: "/messages", headers: client ? { "x-client-id": client } : {}, body: { text } });

test("posts and lists messages", () => {
  const handle = createApp({ now: fakeClock() });
  expect(post(handle, "a", "hello").status).toBe(201);
  const res = handle({ method: "GET", path: "/messages", headers: { "x-client-id": "a" } });
  expect(res.body.messages.map((m) => m.text)).toEqual(["hello"]);
});

test("rejects an empty message", () => {
  const handle = createApp({ now: fakeClock() });
  expect(post(handle, "a", "   ").status).toBe(400);
});

test("allows up to the limit, then answers 429", () => {
  const handle = createApp({ now: fakeClock() });
  for (let i = 0; i < 5; i++) expect(post(handle, "a").status).toBe(201);
  expect(post(handle, "a").status).toBe(429);
});
`;

const HIDDEN_TESTS = String.raw`const { createApp } = require("../src/app");
const { createRateLimiter } = require("../src/rateLimiter");

function fakeClock() {
  let t = 0;
  const now = () => t;
  now.advance = (ms) => { t += ms; };
  return now;
}
const post = (handle, client) =>
  handle({ method: "POST", path: "/messages", headers: client ? { "x-client-id": client } : {}, body: { text: "hi" } });

test("limiter: counts remaining requests down to zero", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 3, now: fakeClock() });
  expect(limiter.check("a")).toEqual({ allowed: true, remaining: 2 });
  expect(limiter.check("a")).toEqual({ allowed: true, remaining: 1 });
  expect(limiter.check("a")).toEqual({ allowed: true, remaining: 0 });
  expect(limiter.check("a").allowed).toBe(false);
});

test("limiter: a request stops counting exactly windowMs later", () => {
  const now = fakeClock();
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, now });
  expect(limiter.check("a").allowed).toBe(true);
  now.advance(999);
  expect(limiter.check("a").allowed).toBe(false);
  now.advance(1);
  expect(limiter.check("a").allowed).toBe(true);
});

test("limiter: rejected requests don't count", () => {
  const now = fakeClock();
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, now });
  limiter.check("a");
  now.advance(500);
  expect(limiter.check("a").allowed).toBe(false);
  now.advance(500);
  expect(limiter.check("a").allowed).toBe(true);
});

test("limiter: retryAfterMs is when the oldest request leaves the window", () => {
  const now = fakeClock();
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, now });
  limiter.check("a");
  now.advance(300);
  limiter.check("a");
  now.advance(200);
  expect(limiter.check("a")).toEqual({ allowed: false, retryAfterMs: 500 });
});

test("handler: Retry-After is in whole seconds, rounded up", () => {
  const now = fakeClock();
  const handle = createApp({ now });
  for (let i = 0; i < 5; i++) post(handle, "a");
  now.advance(20500);
  const res = post(handle, "a");
  expect(res.status).toBe(429);
  expect(res.headers["Retry-After"]).toBe("40");
});

test("handler: clients are limited separately; no header means anonymous", () => {
  const handle = createApp({ now: fakeClock() });
  for (let i = 0; i < 5; i++) post(handle, "a");
  expect(post(handle, "a").status).toBe(429);
  expect(post(handle, "b").status).toBe(201);
  for (let i = 0; i < 5; i++) expect(post(handle, null).status).toBe(201);
  expect(post(handle, null).status).toBe(429);
});

test("handler: allowed responses carry X-RateLimit-Remaining", () => {
  const handle = createApp({ now: fakeClock() });
  expect(post(handle, "a").headers["X-RateLimit-Remaining"]).toBe("4");
  expect(handle({ method: "GET", path: "/messages", headers: { "x-client-id": "a" } }).headers["X-RateLimit-Remaining"]).toBe("3");
});

test("handler: the limit resets after the window", () => {
  const now = fakeClock();
  const handle = createApp({ now });
  for (let i = 0; i < 5; i++) post(handle, "a");
  now.advance(60000);
  expect(post(handle, "a").status).toBe(201);
});
`;

const limiterReply = (body: string) =>
  `Here's a sliding-window limiter. It keeps the timestamps of each client's allowed requests, drops the ones that have left the window, and rejects when the window is full:\n\n${fence(body)}\n\nRejected requests aren't recorded, so a client that keeps retrying doesn't lock itself out for longer.`;

const handleReply = (body: string) =>
  `Wrap \`route\` with the limiter inside \`createHandler\`:\n\n${fence(body)}\n\nEvery request counts, including 404s, which is the usual choice for an API-level limiter.`;

export const rateLimitTask: AssistedTask = {
  id: "rate-limit",
  title: "Rate-limit a messages API",
  summary: "Add per-client sliding-window rate limiting to an HTTP handler, with Retry-After and remaining-count headers.",
  modeledOn: "Meta's AI-enabled round and practical startup rounds: extend a small service with an AI assistant at your side.",
  entry: "src/rateLimiter.js",
  brief: `The messages API (\`src/handler.js\`) has no protection against a client flooding it. Add per-client rate limiting:

- Implement \`createRateLimiter\` in \`src/rateLimiter.js\` (the comment at the top describes it). Each client may make at most \`max\` requests in any \`windowMs\` window (\`config.js\`: 5 per minute). A request counts for exactly \`windowMs\` after it is made, and rejected requests don't count.
- In \`src/handler.js\`, limit every request by the \`x-client-id\` header (no header means the client \`"anonymous"\`).
- Over the limit, answer \`429\` with a \`Retry-After\` header: whole seconds until the client may try again, rounded up.
- Allowed responses get an \`X-RateLimit-Remaining\` header.

Use the assistant however you like, but you must paste or type its code yourself, and its answers can be wrong, as real ones are. Run the tests often. When you finish, you'll explain your change.`,
  files: {
    "config.js": CONFIG,
    "src/app.js": APP,
    "src/handler.js": HANDLER_STARTER,
    "src/rateLimiter.js": LIMITER_STARTER,
    "src/store.js": STORE,
    "tests/handler.test.js": VISIBLE_TESTS,
  },
  visibleTests: ["tests/handler.test.js"],
  hiddenTests: { "tests/grading.test.js": HIDDEN_TESTS },
  reference: {
    "config.js": CONFIG,
    "src/app.js": APP,
    "src/handler.js": HANDLER_REFERENCE,
    "src/rateLimiter.js": LIMITER_REFERENCE,
    "src/store.js": STORE,
    "tests/handler.test.js": VISIBLE_TESTS,
  },
  requirements: [
    { label: "the limiter", keywords: ["limiter", "sliding", "window"] },
    { label: "the 429 response", keywords: ["429", "retry-after", "retry after"] },
    { label: "the remaining header", keywords: ["remaining"] },
    { label: "per-client keys", keywords: ["x-client-id", "anonymous", "per client", "per-client"] },
  ],
  bugs: [
    {
      id: "limit-off-by-one",
      description: "The limiter compared with `>` instead of `>=`, so it let through one request more than the limit.",
      signature: String.raw`recent\.length\s*>(?!=)\s*max`,
      mutate: { path: "src/rateLimiter.js", from: "recent.length >= max", to: "recent.length > max" },
    },
    {
      id: "window-boundary",
      description: "The window check used `<=`, so a request kept counting one millisecond past the window.",
      signature: String.raw`t\s*-\s*ts\s*<=\s*windowMs`,
      mutate: { path: "src/rateLimiter.js", from: "t - ts < windowMs", to: "t - ts <= windowMs" },
    },
    {
      id: "retry-after-ms",
      description: "Retry-After was sent in milliseconds, but the header (and the brief) want whole seconds.",
      signature: String.raw`String\(\s*verdict\.retryAfterMs\s*\)`,
      mutate: {
        path: "src/handler.js",
        from: "String(Math.ceil(verdict.retryAfterMs / 1000))",
        to: "String(verdict.retryAfterMs)",
      },
    },
  ],
  topics: [
    {
      id: "limiter",
      keywords: ["limiter", "ratelimiter", "rate limiter", "sliding", "window", "createratelimiter", "check(", "limit"],
      reply: limiterReply(LIMITER_BODY),
      buggy: [
        { bug: "limit-off-by-one", reply: limiterReply(LIMITER_BODY.replace("recent.length >= max", "recent.length > max")) },
        { bug: "window-boundary", reply: limiterReply(LIMITER_BODY.replace("t - ts < windowMs", "t - ts <= windowMs")) },
      ],
    },
    {
      id: "handler",
      keywords: ["handler", "429", "retry-after", "retry after", "header", "x-client-id", "wire", "hook", "route", "remaining"],
      reply: handleReply(HANDLE_BODY),
      buggy: [
        {
          bug: "retry-after-ms",
          reply: handleReply(HANDLE_BODY.replace("String(Math.ceil(verdict.retryAfterMs / 1000))", "String(verdict.retryAfterMs)")),
        },
      ],
    },
    {
      id: "tests",
      keywords: ["test", "edge case", "fake clock", "verify", "check my"],
      reply: `Cases worth testing, beyond the ones in \`tests/handler.test.js\`:\n\n- A request made exactly \`windowMs\` after the first one is allowed again (the boundary).\n- Rejected requests don't extend the wait.\n- \`retryAfterMs\` is when the *oldest* counted request leaves the window.\n- Two clients don't share a budget, and requests with no header share the \`"anonymous"\` budget.\n- \`Retry-After\` rounds up: 39.5 seconds left should say \`"40"\`.\n\nThe fake clock in the test file (\`now.advance(ms)\`) makes these quick to write.`,
    },
    {
      id: "explain",
      keywords: ["explain", "what does", "how does", "overview", "walk me", "structure", "codebase", "where"],
      reply: `Quick tour:\n\n- \`config.js\`: the limit (5 requests per 60 s) and the max message length.\n- \`src/app.js\`: builds the store, the limiter and the handler; tests pass a fake clock through \`createApp({ now })\`.\n- \`src/handler.js\`: \`route(req)\` does the real work for \`GET\` and \`POST /messages\`; \`handle\` is the entry point where the limiting belongs.\n- \`src/rateLimiter.js\`: the stub to implement; the comment at the top is the contract.\n- \`src/store.js\`: an in-memory list of messages.`,
    },
  ],
};
