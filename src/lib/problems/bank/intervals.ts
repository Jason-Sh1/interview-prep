import type { Problem } from "../types";

const backToBack = (n: number) => Array.from({ length: n }, (_, i) => [i, i + 1]);
const spacedOut = (n: number) => Array.from({ length: n }, (_, i) => [3 * (n - 1 - i), 3 * (n - 1 - i) + 1]);

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
];
