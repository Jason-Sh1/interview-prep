import type { Problem } from "../types";

// A 1000-number stream for the median design problem: a permutation of 0..999
// (37 is coprime with 1000), queried for the median at the end.
const bigStream = Array.from({ length: 1000 }, (_, i) => (i * 37) % 1000);

export const heap: Problem[] = [
  {
    slug: "smash-the-heaviest-rocks",
    title: "Smash the Heaviest Rocks",
    pattern: "heap",
    difficulty: "easy",
    rating: 1000,
    statement: `You have a pile of rocks with positive integer weights given in \`stones\`. Repeatedly pick the two heaviest rocks, with weights \`a >= b\`, and smash them together:

- if \`a == b\`, both rocks are destroyed;
- otherwise the lighter one is destroyed and the heavier one now weighs \`a - b\`.

Stop when at most one rock remains. Return the weight of the last rock, or \`0\` if none are left.`,
    constraints: ["1 <= stones.length <= 30", "1 <= stones[i] <= 1000"],
    hints: [
      "You need the two largest values over and over while the collection keeps changing.",
      "Put every weight in a max-heap. Pop two, push back the difference if it is non-zero, and repeat until the heap has one or zero items.",
      "h = max_heap(stones)\nwhile len(h) > 1:\n    a, b = pop(h), pop(h)\n    if a != b: push(h, a - b)\nreturn h[0] if h else 0",
    ],
    complexity: { time: "O(n log n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "lastStoneWeight",
      params: [{ name: "stones", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[2, 7, 4, 1, 8, 1]], expected: 1, sample: true },
      { input: [[3, 7, 2]], expected: 2, sample: true },
      { input: [[1]], expected: 1, label: "single rock" },
      { input: [[2, 2]], expected: 0, label: "equal pair" },
      { input: [[10, 4, 2, 10]], expected: 2, label: "duplicates" },
      { input: [[1, 1, 1]], expected: 1, label: "all equal, odd count" },
      { input: [[9, 3, 2, 10]], expected: 0, label: "everything destroyed" },
      { input: [[1000, 1]], expected: 999, label: "large weight" },
    ],
    companies: ["Amazon", "Google", "Microsoft"],
    source: { name: "LeetCode 1046. Last Stone Weight", url: "https://leetcode.com/problems/last-stone-weight/" },
    reference: `class MaxHeap {
  constructor() { this.a = []; }
  size() { return this.a.length; }
  push(v) {
    const a = this.a; a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p] >= a[i]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l] > a[m]) m = l;
        if (r < a.length && a[r] > a[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}
function lastStoneWeight(stones) {
  const h = new MaxHeap();
  for (const s of stones) h.push(s);
  while (h.size() > 1) {
    const a = h.pop(), b = h.pop();
    if (a !== b) h.push(a - b);
  }
  return h.size() ? h.pop() : 0;
}`,
  },
  {
    slug: "nearest-k-landmarks",
    title: "Nearest K Landmarks",
    pattern: "heap",
    difficulty: "medium",
    rating: 1300,
    statement: `You are standing at the origin \`(0, 0)\` of a map. Each entry of \`points\` is a landmark \`[x, y]\`. Distance is the usual straight-line (Euclidean) distance.

Return the \`k\` landmarks closest to you, in any order. The tests are built so that the set of \`k\` closest landmarks is unique.`,
    constraints: [
      "1 <= k <= points.length <= 10^4",
      "-10^4 <= x, y <= 10^4",
      "The answer is unique (no tie at the boundary)",
    ],
    hints: [
      "You don't need the square root to compare distances, and you don't need to fully sort all points.",
      "Keep a max-heap of size k keyed by x^2 + y^2. When it grows past k, drop the farthest point. What remains are the k closest.",
      "h = []  # max-heap by distance\nfor p in points:\n    push(h, (-(x*x + y*y), p))\n    if len(h) > k: pop(h)\nreturn [p for _, p in h]",
    ],
    complexity: { time: "O(n log k)", space: "O(k)" },
    signature: {
      kind: "function",
      name: "kClosest",
      params: [
        { name: "points", type: "int[][]" },
        { name: "k", type: "int" },
      ],
      returns: "int[][]",
      compare: "unordered",
    },
    tests: [
      { input: [[[1, 3], [-2, 2]], 1], expected: [[-2, 2]], sample: true },
      { input: [[[3, 3], [5, -1], [-2, 4]], 2], expected: [[3, 3], [-2, 4]], sample: true },
      { input: [[[0, 0]], 1], expected: [[0, 0]], label: "single point" },
      { input: [[[1, 1], [2, 2]], 2], expected: [[1, 1], [2, 2]], label: "k equals n" },
      { input: [[[-5, -5], [-1, 0], [3, -4]], 2], expected: [[-1, 0], [3, -4]], label: "negatives" },
      { input: [[[1, 1], [1, 1], [3, 3]], 2], expected: [[1, 1], [1, 1]], label: "duplicate points" },
      {
        input: [[[2, 2], [-1, -1], [0, 3], [1, 0]], 3],
        expected: [[1, 0], [-1, -1], [2, 2]],
        label: "close distances",
      },
      { input: [[[10000, 10000], [-10000, 9999]], 1], expected: [[-10000, 9999]], label: "large coordinates" },
    ],
    companies: ["Meta", "Amazon", "Google", "LinkedIn", "Uber"],
    source: {
      name: "LeetCode 973. K Closest Points to Origin",
      url: "https://leetcode.com/problems/k-closest-points-to-origin/",
    },
    reference: `function kClosest(points, k) {
  // Max-heap of [dist, point] capped at size k.
  const a = [];
  const d = (p) => p[0] * p[0] + p[1] * p[1];
  function up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] >= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  function down(i) {
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < a.length && a[l][0] > a[m][0]) m = l;
      if (r < a.length && a[r][0] > a[m][0]) m = r;
      if (m === i) return;
      [a[m], a[i]] = [a[i], a[m]]; i = m;
    }
  }
  for (const p of points) {
    const e = [d(p), p];
    if (a.length < k) { a.push(e); up(a.length - 1); }
    else if (e[0] < a[0][0]) { a[0] = e; down(0); }
  }
  return a.map((e) => e[1]);
}`,
  },
  {
    slug: "running-middle-value",
    title: "Running Middle Value",
    pattern: "heap",
    difficulty: "hard",
    rating: 1720,
    statement: `Design a class \`MedianFinder\` that receives integers one at a time and can report the median of everything seen so far.

- \`MedianFinder()\` creates an empty tracker.
- \`addNum(num)\` adds the integer \`num\`.
- \`findMedian()\` returns the median of all numbers added so far. With an odd count it is the middle value in sorted order; with an even count it is the average of the two middle values.

Both operations will be called many times, so re-sorting on every query is too slow.`,
    constraints: [
      "-10^5 <= num <= 10^5",
      "findMedian is only called after at least one addNum",
      "At most 5 * 10^4 calls in total",
    ],
    hints: [
      "Split the numbers into a lower half and an upper half. The median only depends on the largest of the lower half and the smallest of the upper half.",
      "Keep the lower half in a max-heap and the upper half in a min-heap. After each insert, rebalance so the lower heap has the same size or one more element.",
      "def add(num):\n    push(low, num)          # max-heap\n    push(high, pop(low))    # min-heap\n    if len(high) > len(low): push(low, pop(high))\ndef median():\n    return top(low) if len(low) > len(high) else (top(low) + top(high)) / 2",
    ],
    complexity: { time: "O(log n)", space: "O(n)" },
    signature: {
      kind: "design",
      className: "MedianFinder",
      constructorParams: [],
      methods: [
        { name: "addNum", params: [{ name: "num", type: "int" }], returns: "void" },
        { name: "findMedian", params: [], returns: "float" },
      ],
    },
    tests: [
      {
        input: [
          ["MedianFinder", "addNum", "addNum", "findMedian", "addNum", "findMedian"],
          [[], [1], [2], [], [3], []],
        ],
        expected: [null, null, null, 1.5, null, 2],
        sample: true,
      },
      {
        input: [
          ["MedianFinder", "addNum", "findMedian", "addNum", "findMedian", "addNum", "findMedian"],
          [[], [5], [], [15], [], [1], []],
        ],
        expected: [null, null, 5, null, 10, null, 5],
        sample: true,
      },
      {
        input: [["MedianFinder", "addNum", "findMedian"], [[], [-7], []]],
        expected: [null, null, -7],
        label: "single number",
      },
      {
        input: [
          ["MedianFinder", "addNum", "addNum", "findMedian", "addNum", "findMedian"],
          [[], [-1], [-2], [], [-3], []],
        ],
        expected: [null, null, null, -1.5, null, -2],
        label: "negatives",
      },
      {
        input: [
          ["MedianFinder", "addNum", "addNum", "addNum", "addNum", "findMedian"],
          [[], [4], [4], [4], [4], []],
        ],
        expected: [null, null, null, null, null, 4],
        label: "duplicates",
      },
      {
        input: [
          ["MedianFinder", "addNum", "addNum", "addNum", "addNum", "findMedian", "addNum", "findMedian"],
          [[], [10], [8], [6], [4], [], [2], []],
        ],
        expected: [null, null, null, null, null, 7, null, 6],
        label: "descending input",
      },
      {
        input: [
          ["MedianFinder", "addNum", "addNum", "findMedian", "addNum", "addNum", "findMedian"],
          [[], [100000], [-100000], [], [0], [1], []],
        ],
        expected: [null, null, null, 0, null, null, 0.5],
        label: "extreme values",
      },
      {
        input: [
          ["MedianFinder", ...bigStream.map(() => "addNum"), "findMedian"],
          [[], ...bigStream.map((v) => [v]), []],
        ],
        expected: [null, ...bigStream.map(() => null), 499.5],
        label: "long stream",
      },
    ],
    companies: ["Amazon", "Google", "Microsoft", "Apple", "Uber"],
    source: {
      name: "LeetCode 295. Find Median from Data Stream",
      url: "https://leetcode.com/problems/find-median-from-data-stream/",
    },
    reference: `class Heap {
  constructor(less) { this.a = []; this.less = less; }
  size() { return this.a.length; }
  top() { return this.a[0]; }
  push(v) {
    const a = this.a; a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}
class MedianFinder {
  constructor() {
    this.low = new Heap((x, y) => x > y);
    this.high = new Heap((x, y) => x < y);
  }
  addNum(num) {
    this.low.push(num);
    this.high.push(this.low.pop());
    if (this.high.size() > this.low.size()) this.low.push(this.high.pop());
  }
  findMedian() {
    if (this.low.size() > this.high.size()) return this.low.top();
    return (this.low.top() + this.high.top()) / 2;
  }
}`,
  },
];
