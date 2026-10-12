import type { DebugTask } from "../types";

// A meeting scheduler that finds free slots in a workday. Three bugs are
// seeded: intervals are sorted with the default (string) sort, merging a
// meeting nested inside another shrinks the busy block, and the gap after the
// last meeting is never offered.

const TIME = String.raw`// "HH:MM" strings <-> minutes since midnight.

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) throw new Error("bad time " + hhmm);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error("bad time " + hhmm);
  return h * 60 + min;
}

function toHHMM(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

module.exports = { toMinutes, toHHMM };
`;

const INTERVALS = String.raw`// Busy intervals are [start, end] pairs in minutes, end exclusive.

/** Merges overlapping or touching intervals. Returns new intervals sorted by start. */
function merge(intervals) {
  const sorted = intervals.map((i) => [i[0], i[1]]).sort();
  const out = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (last && cur[0] <= last[1]) last[1] = cur[1];
    else out.push(cur);
  }
  return out;
}

module.exports = { merge };
`;

const AVAILABILITY = String.raw`// Finds times everyone is free.
const { toMinutes, toHHMM } = require("./time");
const { merge } = require("./intervals");

/**
 * Free gaps of at least durationMin minutes inside the workday.
 * opts = { workday: { start, end }, busy: [{ start, end }], durationMin }
 * where every time is "HH:MM". Busy times outside the workday are ignored.
 * Returns [{ start, end }] in order.
 */
function freeSlots(opts) {
  const dayStart = toMinutes(opts.workday.start);
  const dayEnd = toMinutes(opts.workday.end);
  const blocks = merge(
    opts.busy
      .map((b) => [Math.max(toMinutes(b.start), dayStart), Math.min(toMinutes(b.end), dayEnd)])
      .filter((b) => b[0] < b[1]),
  );
  const out = [];
  let cursor = dayStart;
  for (const [start, end] of blocks) {
    if (start - cursor >= opts.durationMin) out.push({ start: toHHMM(cursor), end: toHHMM(start) });
    cursor = Math.max(cursor, end);
  }
  return out;
}

/** The earliest slot, or null. */
function firstSlot(opts) {
  const slots = freeSlots(opts);
  return slots.length ? slots[0] : null;
}

module.exports = { freeSlots, firstSlot };
`;

const VISIBLE_TESTS = String.raw`const { toMinutes, toHHMM } = require("../src/time");
const { merge } = require("../src/intervals");
const { freeSlots, firstSlot } = require("../src/availability");

const day = { start: "09:00", end: "17:00" };

describe("time", () => {
  test("parses and formats", () => {
    expect(toMinutes("09:05")).toBe(545);
    expect(toHHMM(545)).toBe("09:05");
  });
});

describe("merge", () => {
  test("joins overlapping meetings", () => {
    expect(merge([[60, 120], [90, 150]])).toEqual([[60, 150]]);
  });
});

describe("freeSlots", () => {
  test("around one meeting", () => {
    expect(freeSlots({ workday: day, busy: [{ start: "10:00", end: "11:00" }], durationMin: 30 })).toEqual([
      { start: "09:00", end: "10:00" },
      { start: "11:00", end: "17:00" },
    ]);
  });
  test("first slot skips gaps that are too short", () => {
    const busy = [{ start: "09:15", end: "10:00" }];
    expect(firstSlot({ workday: day, busy, durationMin: 30 })).toEqual({ start: "10:00", end: "17:00" });
  });
});
`;

const HIDDEN_TESTS = String.raw`const { toMinutes } = require("../src/time");
const { merge } = require("../src/intervals");
const { freeSlots } = require("../src/availability");

const day = { start: "09:00", end: "17:00" };

describe("hidden: time", () => {
  test("rejects impossible times", () => {
    expect(() => toMinutes("24:00")).toThrow();
    expect(() => toMinutes("9:60")).toThrow();
  });
});

describe("hidden: merge", () => {
  test("sorts numerically, not as text", () => {
    expect(merge([[600, 660], [90, 120]])).toEqual([[90, 120], [600, 660]]);
  });
  test("keeps the end of a longer meeting that contains a shorter one", () => {
    expect(merge([[540, 720], [600, 630]])).toEqual([[540, 720]]);
  });
  test("joins back-to-back meetings", () => {
    expect(merge([[60, 90], [90, 120]])).toEqual([[60, 120]]);
  });
});

describe("hidden: freeSlots", () => {
  test("early and late meetings in any order", () => {
    const busy = [{ start: "16:45", end: "17:00" }, { start: "09:00", end: "09:30" }];
    expect(freeSlots({ workday: day, busy, durationMin: 30 })).toEqual([{ start: "09:30", end: "16:45" }]);
  });
  test("offers the time after the last meeting", () => {
    expect(freeSlots({ workday: day, busy: [{ start: "09:00", end: "12:00" }], durationMin: 60 })).toEqual([{ start: "12:00", end: "17:00" }]);
  });
  test("a free day is one slot", () => {
    expect(freeSlots({ workday: day, busy: [], durationMin: 60 })).toEqual([{ start: "09:00", end: "17:00" }]);
  });
  test("a meeting inside another doesn't open a gap", () => {
    const busy = [{ start: "10:00", end: "16:00" }, { start: "11:00", end: "11:30" }];
    expect(freeSlots({ workday: day, busy, durationMin: 45 })).toEqual([
      { start: "09:00", end: "10:00" },
      { start: "16:00", end: "17:00" },
    ]);
  });
});
`;

export const availabilityTask: DebugTask = {
  id: "availability-bugs",
  title: "Meeting availability",
  summary: "A scheduler that finds free meeting slots. Some suggested slots clash with meetings, and some free time is never offered.",
  modeledOn: "Google's code comprehension round, and read-and-fix rounds at Microsoft and Atlassian",
  brief: `This module powers "find a time" in a calendar app. Users report two things: it sometimes suggests slots that clash with existing meetings, and it never suggests the end of the day.

1. **Read the code** in \`src/\` until you can explain how free slots are found.
2. **Find and fix the bugs.** There are a few; not every one has a failing test yet.
3. **Finish** by answering a few questions about the code and writing up each bug: what was wrong, the root cause, and how you fixed and checked it.

Times are "HH:MM" strings at the edges and minutes since midnight inside.`,
  files: {
    "src/time.js": TIME,
    "src/intervals.js": INTERVALS,
    "src/availability.js": AVAILABILITY,
    "tests/availability.test.js": VISIBLE_TESTS,
  },
  entry: "src/availability.js",
  visibleTests: ["tests/availability.test.js"],
  hiddenTests: { "tests/hidden.test.js": HIDDEN_TESTS },
  bugs: [
    {
      id: "string-sort",
      file: "src/intervals.js",
      description:
        "`merge` sorted with the default `.sort()`, which compares the pairs as strings, so [1005, 1020] came before [540, 570]; a morning meeting then merged into an afternoon one and disappeared. It needs a numeric comparator.",
      fix: { from: ".sort();", to: ".sort((a, b) => a[0] - b[0] || a[1] - b[1]);" },
      tests: ["hidden: merge > sorts numerically, not as text", "hidden: freeSlots > early and late meetings in any order"],
      keywords: [["sort"], ["string", "text", "lexicographic", "comparator", "numeric", "compare"]],
    },
    {
      id: "nested-end",
      file: "src/intervals.js",
      description:
        "Merging set the block's end to the next meeting's end (`last[1] = cur[1]`), so a short meeting inside a long one cut the busy block short and freed time that was still booked. It should keep the later end: `Math.max(last[1], cur[1])`.",
      fix: { from: "last[1] = cur[1];", to: "last[1] = Math.max(last[1], cur[1]);" },
      tests: ["hidden: merge > keeps the end of a longer meeting that contains a shorter one"],
      keywords: [["nested", "inside", "contain", "contained", "shorter", "overlap"], ["max", "later end", "end", "extend"]],
    },
    {
      id: "tail-gap",
      file: "src/availability.js",
      description: "`freeSlots` only added gaps before each meeting and never the gap between the last meeting and the end of the workday.",
      fix: {
        from: "    cursor = Math.max(cursor, end);\n  }\n  return out;",
        to: "    cursor = Math.max(cursor, end);\n  }\n  if (dayEnd - cursor >= opts.durationMin) out.push({ start: toHHMM(cursor), end: toHHMM(dayEnd) });\n  return out;",
      },
      tests: [
        "freeSlots > around one meeting",
        "freeSlots > first slot skips gaps that are too short",
        "hidden: freeSlots > offers the time after the last meeting",
        "hidden: freeSlots > a free day is one slot",
      ],
      keywords: [["last", "end of the day", "end of day", "after", "tail", "remaining", "dayend"], ["gap", "slot", "free"]],
    },
  ],
  questions: [
    {
      id: "flow",
      prompt: "Walk through how freeSlots() finds free time.",
      answer:
        "It converts the workday and each busy time to minutes, clips busy times to the workday and drops empty ones, merges overlapping meetings into sorted busy blocks, then sweeps a cursor from the start of the day: each gap before a block that's long enough is a slot, and after the last block, the rest of the day is too.",
      keywords: [["minutes", "convert", "tominutes"], ["clip", "workday", "working hours"], ["merge", "sorted", "combine"], ["cursor", "gap", "sweep", "between"]],
    },
    {
      id: "complexity",
      prompt: "What's the time complexity for n busy meetings, and which step dominates?",
      answer: "O(n log n), from sorting in merge; the clipping and the sweep are linear.",
      keywords: [["n log n", "nlogn", "o(n log n)"], ["sort"]],
    },
    {
      id: "change",
      prompt: "How would you extend this to require a 10-minute buffer after every meeting?",
      answer:
        "Extend each busy interval's end by 10 minutes before merging (still clipped to the workday), so buffers merge with nearby meetings and gaps shrink accordingly. Add tests for back-to-back meetings and a meeting near the end of the day.",
      keywords: [["end", "extend", "add", "pad"], ["merge", "before merging", "busy"], ["test", "tests", "edge"]],
    },
  ],
  topics: [
    {
      keywords: ["overview", "explain", "structure", "how does", "walk", "what does"],
      reply:
        "`time.js` converts between \"HH:MM\" and minutes. `intervals.js` merges busy intervals into sorted, non-overlapping blocks. `availability.js` clips meetings to the workday, merges them, and sweeps through the day collecting gaps that are long enough. Start with `freeSlots` and follow its calls.",
    },
    {
      keywords: ["merge", "interval", "sort", "overlap"],
      reply:
        "`merge` copies the intervals, sorts them, then walks through: if the current one starts before the last block ends, they're joined; otherwise it starts a new block. Two things worth testing by hand: what order `.sort()` puts arrays in, and what happens when one meeting sits entirely inside another.",
    },
    {
      keywords: ["slot", "free", "gap", "cursor", "end of day", "freeslots"],
      reply:
        "The sweep keeps a `cursor` at the end of the busy time seen so far. For each block it checks the gap from the cursor to the block's start. Try a day with one morning meeting by hand and list every gap you'd expect, then compare with what the loop can produce.",
    },
    {
      keywords: ["test", "failing", "fail", "error"],
      reply:
        "Read the first failing test's expected and actual values: a missing slot and an extra slot point at different parts of the code. Writing a tiny test for `merge` on its own is a quick way to separate the two.",
    },
  ],
};
