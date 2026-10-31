import type { Problem } from "../types";

const backToBack = (n: number) => Array.from({ length: n }, (_, i) => [i, i + 1]);
const spacedOut = (n: number) => Array.from({ length: n }, (_, i) => [3 * (n - 1 - i), 3 * (n - 1 - i) + 1]);

// Brute-force helpers for expected values.
function rangesBrute(nums: number[]): string[] {
  const out: string[] = [];
  const has = new Set(nums);
  for (const x of nums) {
    if (has.has(x - 1)) continue;
    let y = x;
    while (has.has(y + 1)) y++;
    out.push(x === y ? `${x}` : `${x}->${y}`);
  }
  return out;
}

function mergeAll(list: number[][]): number[][] {
  const sorted = list.map((r) => r.slice()).sort((a, b) => a[0] - b[0]);
  const out: number[][] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push(r);
  }
  return out;
}

function overlapsBrute(first: number[][], second: number[][]): number[][] {
  const out: number[][] = [];
  for (const [a, b] of first)
    for (const [c, d] of second) {
      const lo = Math.max(a, c), hi = Math.min(b, d);
      if (lo <= hi) out.push([lo, hi]);
    }
  return out.sort((x, y) => x[0] - y[0]);
}

function dropsByDp(list: number[][]): number {
  const s = list.slice().sort((a, b) => a[1] - b[1]);
  const keep = s.map(() => 1);
  for (let i = 0; i < s.length; i++)
    for (let j = 0; j < i; j++) if (s[j][1] <= s[i][0]) keep[i] = Math.max(keep[i], keep[j] + 1);
  return s.length - Math.max(0, ...keep);
}

function perQueryBrute(list: number[][], queries: number[]): number[] {
  return queries.map((q) => {
    let best = -1;
    for (const [l, r] of list) if (l <= q && q <= r && (best === -1 || r - l + 1 < best)) best = r - l + 1;
    return best;
  });
}

const bigSorted = Array.from({ length: 2000 }, (_, i) => i * 2 - (i % 7 === 0 ? 0 : i % 3)).filter(
  (v, i, all) => i === 0 || v > all[i - 1],
);
const bigDisjoint = Array.from({ length: 1000 }, (_, i) => [i * 10, i * 10 + 4]);
const calendarA = Array.from({ length: 400 }, (_, i) => [i * 10, i * 10 + 6]);
const calendarB = Array.from({ length: 300 }, (_, i) => [i * 13 + 2, i * 13 + 9]);
const bigRanges = Array.from({ length: 600 }, (_, i) => {
  const start = (i * 37) % 1000;
  return [start, start + ((i * 11) % 40) + 1];
});
const queryRanges = Array.from({ length: 500 }, (_, i) => {
  const start = (i * 53) % 2000;
  return [start, start + ((i * 17) % 90)];
});
const queryPoints = Array.from({ length: 500 }, (_, i) => (i * 29 + 7) % 2100);

export const intervals: Problem[] = [
  {
    slug: "no-double-booking",
    title: "No Double Booking",
    pattern: "intervals",
    difficulty: "easy",
    rating: 1000,
    statement: `You are given a list of meetings, where \`intervals[i] = [start, end]\` means a meeting runs from time \`start\` up to (but not including) time \`end\`.

Return \`true\` if one person could attend every meeting, meaning no two meetings overlap. A meeting that ends at time \`t\` does not overlap one that starts at time \`t\`.`,
    constraints: ["0 <= intervals.length <= 10^4", "0 <= start < end <= 10^6"],
    hints: [
      "Overlaps are easy to spot when the meetings are in time order.",
      "Sort by start time. Then each meeting only needs to be checked against the one right before it.",
      "intervals.sort()\nfor i in range(1, len(intervals)):\n    if intervals[i][0] < intervals[i - 1][1]: return False\nreturn True",
    ],
    complexity: { time: "O(n log n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "canAttendMeetings",
      params: [{ name: "intervals", type: "int[][]" }],
      returns: "bool",
    },
    tests: [
      { input: [[[9, 12], [1, 5], [6, 9]]], expected: true, sample: true },
      { input: [[[1, 4], [3, 6]]], expected: false, sample: true },
      { input: [[]], expected: true, label: "no meetings" },
      { input: [[[5, 8]]], expected: true, label: "single meeting" },
      { input: [[[1, 5], [5, 10]]], expected: true, label: "back to back" },
      { input: [[[1, 10], [2, 3]]], expected: false, label: "nested meeting" },
      { input: [[[3, 4], [3, 4]]], expected: false, label: "identical meetings" },
      { input: [[[20, 30], [0, 5], [10, 21]]], expected: false, label: "overlap only after sorting" },
      { input: [backToBack(1000).reverse()], expected: true, label: "many back-to-back" },
    ],
    companies: ["Meta", "Amazon", "Google", "Bloomberg"],
    source: { name: "LeetCode 252. Meeting Rooms", url: "https://leetcode.com/problems/meeting-rooms/" },
    reference: `function canAttendMeetings(intervals) {
  const xs = intervals.slice().sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < xs.length; i++) if (xs[i][0] < xs[i - 1][1]) return false;
  return true;
}`,
  },
  {
    slug: "combine-overlapping-ranges",
    title: "Combine Overlapping Ranges",
    pattern: "intervals",
    difficulty: "medium",
    rating: 1280,
    statement: `You are given a list of closed ranges, where \`intervals[i] = [start, end]\`. Combine every group of ranges that overlap into a single range, and return the resulting ranges sorted by start.

Ranges that merely touch (one ends exactly where another begins) count as overlapping, so \`[1, 4]\` and \`[4, 5]\` become \`[1, 5]\`.`,
    constraints: ["1 <= intervals.length <= 10^4", "0 <= start <= end <= 10^4"],
    hints: [
      "If the ranges are sorted by start, which ones can a range possibly overlap with?",
      "Sort by start. Keep a list of merged ranges; for each range, if it starts at or before the end of the last merged range, extend that end; otherwise append it.",
      "intervals.sort()\nout = []\nfor s, e in intervals:\n    if out and s <= out[-1][1]: out[-1][1] = max(out[-1][1], e)\n    else: out.append([s, e])\nreturn out",
    ],
    complexity: { time: "O(n log n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "merge",
      params: [{ name: "intervals", type: "int[][]" }],
      returns: "int[][]",
    },
    tests: [
      {
        input: [[[2, 5], [9, 11], [1, 3], [12, 14], [10, 12]]],
        expected: [
          [1, 5],
          [9, 14],
        ],
        sample: true,
      },
      { input: [[[1, 4], [4, 5]]], expected: [[1, 5]], sample: true },
      { input: [[[5, 7]]], expected: [[5, 7]], label: "single range" },
      { input: [[[1, 10], [2, 3], [4, 5]]], expected: [[1, 10]], label: "contained ranges" },
      {
        input: [[[6, 8], [1, 2], [3, 4]]],
        expected: [
          [1, 2],
          [3, 4],
          [6, 8],
        ],
        label: "unsorted, disjoint",
      },
      { input: [[[2, 2], [2, 2]]], expected: [[2, 2]], label: "identical points" },
      {
        input: [[[1, 4], [0, 0]]],
        expected: [
          [0, 0],
          [1, 4],
        ],
        label: "zero-length range",
      },
      { input: [[[1, 4], [0, 2], [3, 5]]], expected: [[0, 5]], label: "chain merge" },
      { input: [spacedOut(300)], expected: spacedOut(300).reverse(), label: "many disjoint ranges" },
    ],
    companies: ["Google", "Meta", "Amazon", "Microsoft", "Bloomberg"],
    source: { name: "LeetCode 56. Merge Intervals", url: "https://leetcode.com/problems/merge-intervals/" },
    reference: `function merge(intervals) {
  const xs = intervals.map((x) => [x[0], x[1]]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [s, e] of xs) {
    if (out.length && s <= out[out.length - 1][1]) {
      out[out.length - 1][1] = Math.max(out[out.length - 1][1], e);
    } else {
      out.push([s, e]);
    }
  }
  return out;
}`,
  },
  {
    slug: "conference-rooms-needed",
    title: "Conference Rooms Needed",
    pattern: "intervals",
    difficulty: "medium",
    rating: 1500,
    statement: `You are given a list of meetings, where \`intervals[i] = [start, end]\` means a meeting runs from time \`start\` up to (but not including) time \`end\`.

Return the minimum number of conference rooms needed so that every meeting gets a room for its whole duration. A room freed at time \`t\` can be reused by a meeting starting at time \`t\`.`,
    constraints: ["0 <= intervals.length <= 10^4", "0 <= start < end <= 10^6"],
    hints: [
      "The answer is the largest number of meetings happening at the same moment.",
      "Sort the start times and the end times separately. Sweep through the starts; before counting a new start, release every meeting whose end is <= that start. (Or keep a min-heap of end times.)",
      "starts = sorted(s for s, e in intervals); ends = sorted(e for s, e in intervals)\nrooms = best = j = 0\nfor s in starts:\n    while ends[j] <= s: rooms -= 1; j += 1\n    rooms += 1; best = max(best, rooms)\nreturn best",
    ],
    complexity: { time: "O(n log n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "minMeetingRooms",
      params: [{ name: "intervals", type: "int[][]" }],
      returns: "int",
    },
    tests: [
      { input: [[[1, 5], [2, 6], [8, 9]]], expected: 2, sample: true },
      { input: [[[4, 9], [9, 12]]], expected: 1, sample: true },
      { input: [[]], expected: 0, label: "no meetings" },
      { input: [[[1, 2]]], expected: 1, label: "single meeting" },
      { input: [[[1, 10], [2, 9], [3, 8]]], expected: 3, label: "nested meetings" },
      { input: [[[1, 3], [2, 4], [3, 5]]], expected: 2, label: "staggered" },
      { input: [[[0, 5], [0, 5], [5, 10]]], expected: 2, label: "same start" },
      { input: [[[13, 15], [1, 13], [6, 9], [2, 4]]], expected: 2, label: "unsorted" },
      { input: [Array.from({ length: 100 }, () => [0, 10])], expected: 100, label: "all at once" },
      { input: [backToBack(500)], expected: 1, label: "many back-to-back" },
    ],
    companies: ["Google", "Meta", "Amazon", "Microsoft", "Uber"],
    source: { name: "LeetCode 253. Meeting Rooms II", url: "https://leetcode.com/problems/meeting-rooms-ii/" },
    reference: `function minMeetingRooms(intervals) {
  const starts = intervals.map((x) => x[0]).sort((a, b) => a - b);
  const ends = intervals.map((x) => x[1]).sort((a, b) => a - b);
  let rooms = 0, best = 0, j = 0;
  for (const s of starts) {
    while (ends[j] <= s) { rooms--; j++; }
    rooms++;
    if (rooms > best) best = rooms;
  }
  return best;
}`,
  },
  {
    slug: "compress-into-ranges",
    title: "Compress Into Ranges",
    pattern: "intervals",
    difficulty: "easy",
    rating: 1050,
    statement: `You get a sorted array \`nums\` of distinct integers. Describe it as the shortest list of ranges that covers exactly these numbers: a run of consecutive integers \`a, a + 1, ..., b\` becomes one range.

Return the ranges in increasing order, written as \`"a->b"\` when \`a != b\` and as \`"a"\` when the range holds a single number.`,
    constraints: ["0 <= nums.length <= 2000", "-2^31 <= nums[i] <= 2^31 - 1", "nums is sorted in increasing order with no repeats."],
    hints: [
      "A new range starts wherever the next number is not exactly one more than the previous.",
      "Walk the array remembering where the current run started. When nums[i + 1] != nums[i] + 1 (or the array ends), close the run and format it.",
      "out, i = [], 0\nwhile i < len(nums):\n    j = i\n    while j + 1 < len(nums) and nums[j + 1] == nums[j] + 1: j += 1\n    out.append(str(nums[i]) if i == j else f'{nums[i]}->{nums[j]}')\n    i = j + 1\nreturn out",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "summaryRanges",
      params: [{ name: "nums", type: "int[]" }],
      returns: "string[]",
    },
    tests: [
      { input: [[0, 1, 2, 4, 5, 7]], expected: ["0->2", "4->5", "7"], sample: true },
      { input: [[0, 2, 3, 4, 6, 8, 9]], expected: ["0", "2->4", "6", "8->9"], sample: true },
      { input: [[]], expected: [], label: "empty input" },
      { input: [[5]], expected: ["5"], label: "single number" },
      { input: [[1, 2, 3, 4]], expected: ["1->4"], label: "one long run" },
      { input: [[1, 3, 5]], expected: ["1", "3", "5"], label: "no runs" },
      { input: [[-3, -2, -1, 1]], expected: ["-3->-1", "1"], label: "negative numbers" },
      { input: [[-2147483648, -2147483647, 2147483647]], expected: ["-2147483648->-2147483647", "2147483647"], label: "32-bit extremes" },
      { input: [bigSorted], expected: rangesBrute(bigSorted), label: "large input" },
    ],
    companies: ["Google", "Meta", "Yandex", "Microsoft"],
    source: { name: "LeetCode 228. Summary Ranges", url: "https://leetcode.com/problems/summary-ranges/" },
    reference: `function summaryRanges(nums) {
  const out = [];
  let i = 0;
  while (i < nums.length) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(i === j ? String(nums[i]) : nums[i] + "->" + nums[j]);
    i = j + 1;
  }
  return out;
}`,
  },
  {
    slug: "slot-in-a-new-range",
    title: "Slot In a New Range",
    pattern: "intervals",
    difficulty: "medium",
    rating: 1230,
    statement: `\`intervals\` is a list of non-overlapping ranges \`[start, end]\`, sorted by start. Add \`newInterval\` to the list, merging it with every range it overlaps or touches (ranges that share an endpoint, like \`[1, 3]\` and \`[3, 5]\`, merge), so the list stays sorted and non-overlapping.

Return the resulting list.`,
    constraints: [
      "0 <= intervals.length <= 10^4",
      "intervals[i] = [start, end] with 0 <= start <= end <= 10^5",
      "intervals is sorted by start and has no overlaps",
      "newInterval = [start, end] with 0 <= start <= end <= 10^5",
    ],
    hints: [
      "The list splits into three parts: ranges entirely before the new one, ranges that overlap it, and ranges entirely after it.",
      "Copy every range that ends before newInterval starts. Then, while ranges start at or before newInterval ends, widen newInterval to cover them. Add it, then copy the rest.",
      "out, i, (lo, hi) = [], 0, newInterval\nwhile i < n and intervals[i][1] < lo: out.append(intervals[i]); i += 1\nwhile i < n and intervals[i][0] <= hi:\n    lo = min(lo, intervals[i][0]); hi = max(hi, intervals[i][1]); i += 1\nout.append([lo, hi])\nreturn out + intervals[i:]",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "insert",
      params: [
        { name: "intervals", type: "int[][]" },
        { name: "newInterval", type: "int[]" },
      ],
      returns: "int[][]",
    },
    tests: [
      { input: [[[1, 3], [6, 9]], [2, 5]], expected: [[1, 5], [6, 9]], sample: true },
      { input: [[[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]], expected: [[1, 2], [3, 10], [12, 16]], sample: true },
      { input: [[], [5, 7]], expected: [[5, 7]], label: "empty list" },
      { input: [[[3, 4]], [0, 1]], expected: [[0, 1], [3, 4]], label: "goes first" },
      { input: [[[3, 4]], [6, 9]], expected: [[3, 4], [6, 9]], label: "goes last" },
      { input: [[[1, 3], [5, 7]], [3, 5]], expected: [[1, 7]], label: "touching endpoints merge" },
      { input: [[[2, 3], [4, 5], [6, 7]], [1, 10]], expected: [[1, 10]], label: "swallows everything" },
      { input: [[[1, 10]], [4, 5]], expected: [[1, 10]], label: "already covered" },
      { input: [[[1, 2], [8, 9]], [4, 6]], expected: [[1, 2], [4, 6], [8, 9]], label: "fits in a gap" },
      { input: [bigDisjoint, [2503, 5007]], expected: mergeAll([...bigDisjoint, [2503, 5007]]), label: "large input" },
    ],
    companies: ["Google", "Meta", "LinkedIn", "Amazon", "Microsoft"],
    source: { name: "LeetCode 57. Insert Interval", url: "https://leetcode.com/problems/insert-interval/" },
    reference: `function insert(intervals, newInterval) {
  const out = [];
  let i = 0, lo = newInterval[0], hi = newInterval[1];
  while (i < intervals.length && intervals[i][1] < lo) out.push(intervals[i++]);
  while (i < intervals.length && intervals[i][0] <= hi) {
    lo = Math.min(lo, intervals[i][0]);
    hi = Math.max(hi, intervals[i][1]);
    i++;
  }
  out.push([lo, hi]);
  while (i < intervals.length) out.push(intervals[i++]);
  return out;
}`,
  },
  {
    slug: "overlap-of-two-calendars",
    title: "Overlap of Two Calendars",
    pattern: "intervals",
    difficulty: "medium",
    rating: 1350,
    statement: `Two people share their busy times as lists of closed ranges, \`first\` and \`second\`. Each list is sorted and its ranges do not overlap one another.

Return every range of time when both people are busy, sorted by start. A single shared moment counts: \`[1, 3]\` and \`[3, 5]\` overlap in \`[3, 3]\`.`,
    constraints: [
      "0 <= first.length, second.length <= 1000",
      "first.length + second.length >= 1",
      "0 <= start <= end <= 10^9",
      "Each list is sorted and has no overlaps (end of one range < start of the next).",
    ],
    hints: [
      "Two ranges [a, b] and [c, d] overlap in [max(a, c), min(b, d)] when that is a valid range.",
      "Use one pointer per list. Record the overlap of the two current ranges if it exists, then advance the pointer whose range ends first, since it cannot overlap anything later.",
      "i = j = 0; out = []\nwhile i < len(A) and j < len(B):\n    lo = max(A[i][0], B[j][0]); hi = min(A[i][1], B[j][1])\n    if lo <= hi: out.append([lo, hi])\n    if A[i][1] < B[j][1]: i += 1\n    else: j += 1\nreturn out",
    ],
    complexity: { time: "O(m + n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "intervalIntersection",
      params: [
        { name: "first", type: "int[][]" },
        { name: "second", type: "int[][]" },
      ],
      returns: "int[][]",
    },
    tests: [
      {
        input: [[[0, 2], [5, 10], [13, 23], [24, 25]], [[1, 5], [8, 12], [15, 24], [25, 26]]],
        expected: [[1, 2], [5, 5], [8, 10], [15, 23], [24, 24], [25, 25]],
        sample: true,
      },
      { input: [[[1, 3], [5, 9]], []], expected: [], sample: true },
      { input: [[[1, 7]], [[3, 10]]], expected: [[3, 7]], label: "single overlap" },
      { input: [[[1, 3]], [[3, 5]]], expected: [[3, 3]], label: "shared moment" },
      { input: [[[1, 2]], [[4, 5]]], expected: [], label: "no overlap" },
      { input: [[[0, 100]], [[1, 2], [5, 6], [9, 10]]], expected: [[1, 2], [5, 6], [9, 10]], label: "one range covers many" },
      { input: [[[4, 4]], [[4, 4]]], expected: [[4, 4]], label: "identical points" },
      { input: [[[0, 1000000000]], [[999999999, 1000000000]]], expected: [[999999999, 1000000000]], label: "large values" },
      { input: [calendarA, calendarB], expected: overlapsBrute(calendarA, calendarB), label: "large input" },
    ],
    companies: ["Meta", "Uber", "Amazon", "DoorDash"],
    source: { name: "LeetCode 986. Interval List Intersections", url: "https://leetcode.com/problems/interval-list-intersections/" },
    reference: `function intervalIntersection(first, second) {
  const out = [];
  let i = 0, j = 0;
  while (i < first.length && j < second.length) {
    const lo = Math.max(first[i][0], second[j][0]);
    const hi = Math.min(first[i][1], second[j][1]);
    if (lo <= hi) out.push([lo, hi]);
    if (first[i][1] < second[j][1]) i++;
    else j++;
  }
  return out;
}`,
  },
  {
    slug: "fewest-ranges-to-drop",
    title: "Fewest Ranges to Drop",
    pattern: "intervals",
    difficulty: "medium",
    rating: 1420,
    statement: `You get a list of ranges \`intervals\`, each \`[start, end]\` with \`start < end\`. Two ranges conflict if they overlap by more than a single endpoint; ranges that only touch, like \`[1, 2]\` and \`[2, 3]\`, do not conflict.

Return the fewest ranges you must remove so that no two of the remaining ranges conflict.`,
    constraints: ["1 <= intervals.length <= 10^5", "-5 * 10^4 <= start < end <= 5 * 10^4"],
    hints: [
      "Instead of choosing what to remove, choose the most ranges you can keep. Which range is the safest one to keep first?",
      "Sort by end. Greedily keep a range if it starts at or after the end of the last kept range; otherwise drop it. Ending early leaves the most room for the rest.",
      "intervals.sort(key=lambda r: r[1])\nkept, last_end = 0, -inf\nfor s, e in intervals:\n    if s >= last_end: kept += 1; last_end = e\nreturn len(intervals) - kept",
    ],
    complexity: { time: "O(n log n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "eraseOverlapIntervals",
      params: [{ name: "intervals", type: "int[][]" }],
      returns: "int",
    },
    tests: [
      { input: [[[1, 2], [2, 3], [3, 4], [1, 3]]], expected: 1, sample: true },
      { input: [[[1, 2], [1, 2], [1, 2]]], expected: 2, sample: true },
      { input: [[[1, 2], [2, 3]]], expected: 0, label: "touching ranges" },
      { input: [[[5, 9]]], expected: 0, label: "single range" },
      { input: [[[1, 100], [2, 3], [4, 5], [6, 7]]], expected: 1, label: "drop the long one" },
      { input: [[[0, 2], [1, 3], [2, 4], [3, 5], [4, 6]]], expected: 2, label: "staggered chain" },
      { input: [[[-5, -1], [-3, 2], [0, 4]]], expected: 1, label: "negative values" },
      { input: [[[3, 4], [1, 2], [2, 3]]], expected: 0, label: "unsorted input" },
      { input: [bigRanges], expected: dropsByDp(bigRanges), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Google", "Bloomberg"],
    source: { name: "LeetCode 435. Non-overlapping Intervals", url: "https://leetcode.com/problems/non-overlapping-intervals/" },
    reference: `function eraseOverlapIntervals(intervals) {
  const s = intervals.slice().sort((a, b) => a[1] - b[1]);
  let kept = 0, lastEnd = -Infinity;
  for (const [start, end] of s) {
    if (start >= lastEnd) { kept++; lastEnd = end; }
  }
  return s.length - kept;
}`,
  },
  {
    slug: "smallest-covering-range-per-query",
    title: "Smallest Covering Range per Query",
    pattern: "intervals",
    difficulty: "hard",
    rating: 1760,
    statement: `You get a list of closed ranges \`intervals\`, where \`[left, right]\` covers every integer from \`left\` to \`right\` and has size \`right - left + 1\`, and a list of integers \`queries\`.

For each query \`q\`, find the smallest size of any range that contains \`q\`, or \`-1\` if no range contains it. Return the answers in the same order as \`queries\`.`,
    constraints: [
      "1 <= intervals.length, queries.length <= 10^5",
      "1 <= left <= right <= 10^7",
      "1 <= queries[j] <= 10^7",
    ],
    hints: [
      "Answering queries in increasing order lets you reuse work: ranges that start before the current query stay relevant until they end.",
      "Sort ranges by left and process queries sorted (remember original indices). Push every range with left <= q into a min-heap keyed by size; pop ranges whose right < q; the heap top is the answer.",
      "intervals.sort(); heap = []; i = 0; ans = {}\nfor q in sorted(set(queries)):\n    while i < len(intervals) and intervals[i][0] <= q:\n        l, r = intervals[i]; heappush(heap, (r - l + 1, r)); i += 1\n    while heap and heap[0][1] < q: heappop(heap)\n    ans[q] = heap[0][0] if heap else -1\nreturn [ans[q] for q in queries]",
    ],
    complexity: { time: "O((n + q) log n)", space: "O(n + q)" },
    signature: {
      kind: "function",
      name: "minInterval",
      params: [
        { name: "intervals", type: "int[][]" },
        { name: "queries", type: "int[]" },
      ],
      returns: "int[]",
    },
    tests: [
      { input: [[[1, 4], [2, 4], [3, 6], [4, 4]], [2, 3, 4, 5]], expected: [3, 3, 1, 4], sample: true },
      { input: [[[2, 3], [2, 5], [1, 8], [20, 25]], [2, 19, 5, 22]], expected: [2, -1, 4, 6], sample: true },
      { input: [[[1, 1]], [1, 2]], expected: [1, -1], label: "single point range" },
      { input: [[[5, 10]], [4, 5, 10, 11]], expected: [-1, 6, 6, -1], label: "boundaries are inclusive" },
      { input: [[[1, 100], [40, 60], [50, 50]], [50, 45, 70]], expected: [1, 21, 100], label: "nested ranges" },
      { input: [[[1, 3], [1, 3]], [2, 2]], expected: [3, 3], label: "duplicate ranges and queries" },
      { input: [[[3, 5]], [9, 1]], expected: [-1, -1], label: "nothing covers" },
      { input: [[[1, 10000000]], [10000000]], expected: [10000000], label: "huge range" },
      { input: [queryRanges, queryPoints], expected: perQueryBrute(queryRanges, queryPoints), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Uber"],
    source: {
      name: "LeetCode 1851. Minimum Interval to Include Each Query",
      url: "https://leetcode.com/problems/minimum-interval-to-include-each-query/",
    },
    reference: `function minInterval(intervals, queries) {
  const heap = [];
  const less = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  const push = (x) => {
    heap.push(x);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(heap[i], heap[p])) break;
      [heap[i], heap[p]] = [heap[p], heap[i]];
      i = p;
    }
  };
  const pop = () => {
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && less(heap[l], heap[m])) m = l;
        if (r < heap.length && less(heap[r], heap[m])) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
  };
  const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
  const order = queries.map((q, i) => i).sort((a, b) => queries[a] - queries[b]);
  const out = new Array(queries.length).fill(-1);
  let i = 0;
  for (const qi of order) {
    const q = queries[qi];
    while (i < sorted.length && sorted[i][0] <= q) {
      push([sorted[i][1] - sorted[i][0] + 1, sorted[i][1]]);
      i++;
    }
    while (heap.length && heap[0][1] < q) pop();
    out[qi] = heap.length ? heap[0][0] : -1;
  }
  return out;
}`,
  },
];
