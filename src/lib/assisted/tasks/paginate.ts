import type { AssistedTask } from "../types";
import { fence } from "./util";

const CONFIG = String.raw`module.exports = {
  orders: {
    defaultLimit: 10,
    maxLimit: 50,
  },
};
`;

const DB = String.raw`// A stand-in for the orders table: 37 orders, ids in creation order.
const STATUSES = ["pending", "shipped", "delivered", "cancelled"];

const ORDERS = [];
for (let i = 1; i <= 37; i++) {
  ORDERS.push({
    id: "ord_" + String(i).padStart(3, "0"),
    status: STATUSES[(i * 7) % 4],
    totalCents: 1000 + ((i * 937) % 9000),
  });
}

/** Every order, oldest first (ids sort in creation order). */
function listOrders() {
  return ORDERS.map((o) => ({ ...o }));
}

module.exports = { listOrders, STATUSES };
`;

const CURSOR = String.raw`// Opaque cursors: clients pass back what we gave them and never parse it.
function encodeCursor(orderId) {
  return btoa("order:" + orderId);
}

/** The order id inside a cursor, or null if the cursor isn't one of ours. */
function decodeCursor(cursor) {
  try {
    const s = atob(cursor);
    return s.startsWith("order:") ? s.slice(6) : null;
  } catch (e) {
    return null;
  }
}

module.exports = { encodeCursor, decodeCursor };
`;

const HANDLER_HEAD = String.raw`// HTTP-style handler for the orders API.
// handle(req) takes { method, path, query } (query values are strings) and
// returns { status, body }.
const config = require("../config");
const db = require("./db");
const { encodeCursor, decodeCursor } = require("./cursor");

const bad = (error) => ({ status: 400, body: { error } });
`;

const LIST_STARTER = String.raw`
function listOrdersPage(query) {
  // TODO: support limit, status and cursor (see the brief).
  return { status: 200, body: { items: db.listOrders(), nextCursor: null } };
}
`;

const LIST_BODY = String.raw`function listOrdersPage(query) {
  let limit = config.orders.defaultLimit;
  if (query.limit !== undefined) {
    if (!/^\d+$/.test(query.limit) || Number(query.limit) < 1) return bad("limit must be a positive integer");
    limit = Math.min(Number(query.limit), config.orders.maxLimit);
  }
  if (query.status !== undefined && !db.STATUSES.includes(query.status)) return bad("unknown status");

  let orders = db.listOrders();
  if (query.status) orders = orders.filter((o) => o.status === query.status);

  let start = 0;
  if (query.cursor !== undefined) {
    const after = decodeCursor(query.cursor);
    if (after === null) return bad("invalid cursor");
    start = orders.findIndex((o) => o.id > after);
    if (start === -1) start = orders.length;
  }
  const items = orders.slice(start, start + limit);
  const more = start + limit < orders.length;
  return { status: 200, body: { items, nextCursor: more ? encodeCursor(items[items.length - 1].id) : null } };
}`;

const HANDLER_TAIL = String.raw`
function handle(req) {
  if (req.method === "GET" && req.path === "/orders") return listOrdersPage(req.query || {});
  return { status: 404, body: { error: "not found" } };
}

module.exports = { handle };
`;

const VISIBLE_TESTS = String.raw`const { handle } = require("../src/handler");

const get = (query) => handle({ method: "GET", path: "/orders", query });

test("returns the first page with the default limit", () => {
  const res = get({});
  expect(res.status).toBe(200);
  expect(res.body.items).toHaveLength(10);
  expect(res.body.items[0].id).toBe("ord_001");
  expect(typeof res.body.nextCursor).toBe("string");
});

test("respects a smaller limit", () => {
  expect(get({ limit: "3" }).body.items.map((o) => o.id)).toEqual(["ord_001", "ord_002", "ord_003"]);
});

test("filters by status", () => {
  const items = get({ status: "shipped", limit: "50" }).body.items;
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((o) => o.status === "shipped")).toBe(true);
});
`;

const HIDDEN_TESTS = String.raw`const { handle } = require("../src/handler");
const db = require("../src/db");

const get = (query) => handle({ method: "GET", path: "/orders", query });

function walk(query) {
  const seen = [];
  let cursor;
  for (let i = 0; i < 100; i++) {
    const res = get({ ...query, ...(cursor ? { cursor } : {}) });
    expect(res.status).toBe(200);
    seen.push(...res.body.items.map((o) => o.id));
    if (!res.body.nextCursor) return seen;
    cursor = res.body.nextCursor;
  }
  throw new Error("pagination never ended");
}

test("walking every page returns each order exactly once", () => {
  expect(walk({ limit: "7" })).toEqual(db.listOrders().map((o) => o.id));
});

test("walking a filtered list returns each matching order once", () => {
  const delivered = db.listOrders().filter((o) => o.status === "delivered").map((o) => o.id);
  expect(walk({ status: "delivered", limit: "2" })).toEqual(delivered);
});

test("the last page has no nextCursor, even when it is exactly full", () => {
  const res = get({ limit: "37" });
  expect(res.body.items).toHaveLength(37);
  expect(res.body.nextCursor).toBeNull();
});

test("limit is capped at maxLimit", () => {
  const big = db.listOrders().length > 50 ? 50 : db.listOrders().length;
  expect(get({ limit: "1000" }).body.items.length).toBe(Math.min(50, big));
  const config = require("../config");
  config.orders.maxLimit = 5;
  try {
    expect(get({ limit: "20" }).body.items).toHaveLength(5);
  } finally {
    config.orders.maxLimit = 50;
  }
});

test("bad input is a 400", () => {
  expect(get({ limit: "0" }).status).toBe(400);
  expect(get({ limit: "abc" }).status).toBe(400);
  expect(get({ limit: "2.5" }).status).toBe(400);
  expect(get({ status: "lost" }).status).toBe(400);
  expect(get({ cursor: "not-a-cursor!" }).status).toBe(400);
});
`;

const pageReply = (body: string) =>
  `Here's \`listOrdersPage\` with validation, filtering and cursor pagination. The cursor holds the id of the last order on the page, and the next page starts after it:\n\n${fence(body)}\n\nFiltering happens before paginating, so every page of a filtered list is full except the last.`;

export const paginateTask: AssistedTask = {
  id: "paginate",
  title: "Paginate an orders endpoint",
  summary: "Add cursor pagination, a status filter and input validation to GET /orders.",
  modeledOn: "Practical API rounds at Stripe, Shopify and startups that allow AI tools.",
  entry: "src/handler.js",
  brief: `\`GET /orders\` (\`src/handler.js\`) returns every order at once. Make it paginate:

- \`limit\`: page size, default \`config.orders.defaultLimit\` (10), capped at \`config.orders.maxLimit\` (50). Anything that isn't a positive whole number is a \`400\`.
- \`status\`: only orders with that status (\`pending\`, \`shipped\`, \`delivered\` or \`cancelled\`); any other value is a \`400\`.
- \`cursor\`: continue after the previous page. Respond with \`{ items, nextCursor }\`, where \`nextCursor\` is \`null\` on the last page. Use the helpers in \`src/cursor.js\`; a cursor we didn't issue is a \`400\`.
- Walking all pages must return every order exactly once, in id order, with or without a filter.

Use the assistant however you like, but you must paste or type its code yourself, and its answers can be wrong, as real ones are. Run the tests often. When you finish, you'll explain your change.`,
  files: {
    "config.js": CONFIG,
    "src/cursor.js": CURSOR,
    "src/db.js": DB,
    "src/handler.js": HANDLER_HEAD + LIST_STARTER + HANDLER_TAIL,
    "tests/orders.test.js": VISIBLE_TESTS,
  },
  visibleTests: ["tests/orders.test.js"],
  hiddenTests: { "tests/grading.test.js": HIDDEN_TESTS },
  reference: {
    "config.js": CONFIG,
    "src/cursor.js": CURSOR,
    "src/db.js": DB,
    "src/handler.js": HANDLER_HEAD + "\n" + LIST_BODY + "\n" + HANDLER_TAIL,
    "tests/orders.test.js": VISIBLE_TESTS,
  },
  requirements: [
    { label: "the limit", keywords: ["limit", "page size"] },
    { label: "the status filter", keywords: ["status", "filter"] },
    { label: "cursors", keywords: ["cursor", "next page", "nextcursor"] },
    { label: "validation", keywords: ["400", "validat", "invalid"] },
  ],
  bugs: [
    {
      id: "cursor-repeats-item",
      description: "The next page started at the cursor's order instead of after it (`>=` instead of `>`), so the last order of each page came back again.",
      signature: String.raw`o\.id\s*>=\s*after`,
      mutate: { path: "src/handler.js", from: "o.id > after", to: "o.id >= after" },
    },
    {
      id: "limit-not-capped",
      description: "The page size wasn't capped at maxLimit, so a client could ask for every order at once.",
      signature: String.raw`limit\s*=\s*Number\(\s*query\.limit\s*\)\s*;`,
      mutate: { path: "src/handler.js", from: "limit = Math.min(Number(query.limit), config.orders.maxLimit);", to: "limit = Number(query.limit);" },
    },
  ],
  topics: [
    {
      id: "paginate",
      keywords: ["paginat", "cursor", "page", "limit", "filter", "status", "listorderspage", "next"],
      reply: pageReply(LIST_BODY),
      buggy: [
        { bug: "cursor-repeats-item", reply: pageReply(LIST_BODY.replace("o.id > after", "o.id >= after")) },
        {
          bug: "limit-not-capped",
          reply: pageReply(LIST_BODY.replace("limit = Math.min(Number(query.limit), config.orders.maxLimit);", "limit = Number(query.limit);")),
        },
      ],
    },
    {
      id: "validation",
      keywords: ["validat", "400", "invalid", "bad input", "parse"],
      reply: `For validation, check the raw strings before using them:\n\n${fence(String.raw`if (query.limit !== undefined && (!/^\d+$/.test(query.limit) || Number(query.limit) < 1)) {
  return bad("limit must be a positive integer");
}
if (query.status !== undefined && !db.STATUSES.includes(query.status)) return bad("unknown status");
const after = query.cursor === undefined ? null : decodeCursor(query.cursor);
if (query.cursor !== undefined && after === null) return bad("invalid cursor");`)}\n\nThe regex rejects \`"2.5"\`, \`"-1"\` and \`"abc"\`, which \`parseInt\` would quietly accept or mangle.`,
    },
    {
      id: "tests",
      keywords: ["test", "edge case", "verify", "check my"],
      reply: `Good cases to add:\n\n- Walk every page with a small limit (say 7) and check you get all 37 ids exactly once, in order.\n- The same walk with a status filter.\n- A page that is exactly full at the end of the list should have \`nextCursor: null\`, not a cursor to an empty page.\n- \`limit=1000\` is capped; \`limit=0\`, \`abc\` and \`2.5\` are 400s; a made-up cursor is a 400.`,
    },
    {
      id: "explain",
      keywords: ["explain", "what does", "how does", "overview", "walk me", "structure", "codebase", "where"],
      reply: `Quick tour:\n\n- \`config.js\`: default and maximum page size.\n- \`src/db.js\`: 37 fake orders, with ids that sort in creation order, plus the list of valid statuses.\n- \`src/cursor.js\`: \`encodeCursor(id)\` and \`decodeCursor(cursor)\` (null for anything we didn't issue).\n- \`src/handler.js\`: \`handle\` routes \`GET /orders\` to \`listOrdersPage(query)\`, which is the function to change.`,
    },
  ],
};
