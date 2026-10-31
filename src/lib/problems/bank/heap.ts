import type { Problem } from "../types";

// A 1000-number stream for the median design problem: a permutation of 0..999
// (37 is coprime with 1000), queried for the median at the end.
const bigStream = Array.from({ length: 1000 }, (_, i) => (i * 37) % 1000);

const kthLargestBrute = (nums: number[], k: number) => [...nums].sort((a, b) => b - a)[k - 1];

// Task scheduler by direct simulation: each slot, run the available task with the most remaining copies.
function bruteSchedule(tasks: string[], n: number): number {
  const left = new Map<string, number>();
  for (const t of tasks) left.set(t, (left.get(t) ?? 0) + 1);
  const readyAt = new Map<string, number>();
  let remaining = tasks.length;
  let time = 0;
  while (remaining > 0) {
    let pick: string | null = null;
    for (const [t, c] of left)
      if (c > 0 && (readyAt.get(t) ?? 0) <= time && (pick === null || c > left.get(pick)!)) pick = t;
    if (pick !== null) {
      left.set(pick, left.get(pick)! - 1);
      readyAt.set(pick, time + n + 1);
      remaining--;
    }
    time++;
  }
  return time;
}

// Single-threaded CPU by direct simulation with linear scans.
function bruteCpuOrder(tasks: number[][]): number[] {
  const done = new Array(tasks.length).fill(false);
  const order: number[] = [];
  let time = 0;
  while (order.length < tasks.length) {
    let pick = -1;
    for (let i = 0; i < tasks.length; i++) {
      if (done[i] || tasks[i][0] > time) continue;
      if (pick === -1 || tasks[i][1] < tasks[pick][1] || (tasks[i][1] === tasks[pick][1] && i < pick)) pick = i;
    }
    if (pick === -1) {
      time = Math.min(...tasks.filter((_, i) => !done[i]).map((t) => t[0]));
      continue;
    }
    done[pick] = true;
    order.push(pick);
    time += tasks[pick][1];
  }
  return order;
}

// IPO by direct simulation: each round, scan for the most profitable affordable project.
function bruteCapital(k: number, w: number, profits: number[], capital: number[]): number {
  const used = new Array(profits.length).fill(false);
  for (let r = 0; r < k; r++) {
    let pick = -1;
    for (let i = 0; i < profits.length; i++)
      if (!used[i] && capital[i] <= w && (pick === -1 || profits[i] > profits[pick])) pick = i;
    if (pick === -1) break;
    used[pick] = true;
    w += profits[pick];
  }
  return w;
}

// A long KthLargest session: start from some numbers, then add a stream.
const streamLog = (() => {
  const k = 25;
  const start = Array.from({ length: 40 }, (_, i) => ((i * 7919) % 2001) - 1000);
  const ops: string[] = ["KthLargest"];
  const args: unknown[][] = [[k, start]];
  const expected: (number | null)[] = [null];
  const seen = [...start];
  for (let i = 0; i < 800; i++) {
    const v = ((i * 104729) % 4001) - 2000;
    seen.push(v);
    ops.push("add");
    args.push([v]);
    expected.push(kthLargestBrute(seen, k));
  }
  return { input: [ops, args], expected };
})();

const bigUnsorted = Array.from({ length: 3000 }, (_, i) => ((i * 7919) % 20011) - 10000);
const bigTasks = Array.from({ length: 600 }, (_, i) => "ABCDEFGHIJ"[(i * i + 3 * i) % 10 < 4 ? 0 : (i * 7) % 10]);
const bigJobs = Array.from({ length: 400 }, (_, i) => [(i * 7919) % 3000, ((i * 31) % 20) + 1]);
const ipoProfits = Array.from({ length: 500 }, (_, i) => (i * 7919) % 1000);
const ipoCapital = Array.from({ length: 500 }, (_, i) => (i * 104729) % 5000);

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
  {
    slug: "kth-best-score-so-far",
    title: "Kth Best Score So Far",
    pattern: "heap",
    difficulty: "easy",
    rating: 1050,
    statement: `A leaderboard receives scores one at a time and must always report the \`k\`-th highest score seen so far (counting duplicates).

Design a class \`KthLargest\`:

- \`KthLargest(k, nums)\` starts the leaderboard with the scores in \`nums\`.
- \`add(val)\` records a new score and returns the current \`k\`-th highest score.

Whenever \`add\` returns, at least \`k\` scores have been recorded.`,
    constraints: [
      "1 <= k <= 10^4",
      "0 <= nums.length <= 10^4",
      "-10^4 <= nums[i], val <= 10^4",
      "At most 10^4 calls to add.",
    ],
    hints: [
      "Scores below the current k-th highest can never matter again. How many scores do you really need to keep?",
      "Keep a min-heap of the k highest scores. Push each new score and, if the heap grows past k, pop the smallest. The heap's top is the answer.",
      "init: heap = nums; heapify(heap)\n    while len(heap) > k: heappop(heap)\nadd(val):\n    heappush(heap, val)\n    if len(heap) > k: heappop(heap)\n    return heap[0]",
    ],
    complexity: { time: "O(log k)", space: "O(k)" },
    signature: {
      kind: "design",
      className: "KthLargest",
      constructorParams: [
        { name: "k", type: "int" },
        { name: "nums", type: "int[]" },
      ],
      methods: [{ name: "add", params: [{ name: "val", type: "int" }], returns: "int" }],
    },
    tests: [
      {
        input: [
          ["KthLargest", "add", "add", "add", "add", "add"],
          [[3, [4, 5, 8, 2]], [3], [5], [10], [9], [4]],
        ],
        expected: [null, 4, 5, 5, 8, 8],
        sample: true,
      },
      {
        input: [
          ["KthLargest", "add", "add", "add", "add"],
          [[4, [7, 7, 7, 7, 8, 3]], [2], [10], [9], [9]],
        ],
        expected: [null, 7, 7, 7, 8],
        sample: true,
      },
      {
        input: [["KthLargest", "add", "add"], [[1, []], [-3], [-2]]],
        expected: [null, -3, -2],
        label: "start empty, k = 1",
      },
      {
        input: [["KthLargest", "add", "add", "add"], [[2, [0]], [-1], [1], [-2]]],
        expected: [null, -1, 0, 0],
        label: "fills up to k",
      },
      {
        input: [["KthLargest", "add", "add"], [[3, [5, 5, 5]], [5], [5]]],
        expected: [null, 5, 5],
        label: "all same",
      },
      {
        input: [["KthLargest", "add", "add", "add"], [[2, [1, 2]], [-10000], [10000], [10000]]],
        expected: [null, 1, 2, 10000],
        label: "extreme values",
      },
      {
        input: [["KthLargest", "add", "add", "add"], [[3, [10, 9, 8, 7, 6]], [1], [2], [3]]],
        expected: [null, 8, 8, 8],
        label: "small scores never matter",
      },
      { input: streamLog.input, expected: streamLog.expected, label: "long stream" },
    ],
    companies: ["Amazon", "Meta", "Google", "Microsoft"],
    source: { name: "LeetCode 703. Kth Largest Element in a Stream", url: "https://leetcode.com/problems/kth-largest-element-in-a-stream/" },
    reference: `class KthLargest {
  constructor(k, nums) {
    this.k = k;
    this.h = [];
    for (const x of nums) this.add(x);
  }
  push(x) {
    const h = this.h;
    h.push(x);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p] <= h[i]) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  }
  pop() {
    const h = this.h, top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && h[l] < h[m]) m = l;
        if (r < h.length && h[r] < h[m]) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }
  add(val) {
    this.push(val);
    if (this.h.length > this.k) this.pop();
    return this.h[0];
  }
}`,
  },
  {
    slug: "kth-biggest-in-a-pile",
    title: "Kth Biggest in a Pile",
    pattern: "heap",
    difficulty: "medium",
    rating: 1250,
    statement: `Given an unsorted integer array \`nums\` and an integer \`k\`, return the \`k\`-th largest value in it, counting duplicates (so in \`[3, 3, 1]\` the 2nd largest is \`3\`).

Can you do better than sorting the whole array?`,
    constraints: ["1 <= k <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
    hints: [
      "You only care about the k biggest values. Which of them decides the answer?",
      "Keep a min-heap of size k while scanning: push each value and pop the smallest whenever the heap holds more than k. At the end the heap's top is the k-th largest. (Quickselect gives O(n) on average.)",
      "heap = []\nfor x in nums:\n    heappush(heap, x)\n    if len(heap) > k: heappop(heap)\nreturn heap[0]",
    ],
    complexity: { time: "O(n log k)", space: "O(k)" },
    signature: {
      kind: "function",
      name: "findKthLargest",
      params: [
        { name: "nums", type: "int[]" },
        { name: "k", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: [[3, 2, 1, 5, 6, 4], 2], expected: 5, sample: true },
      { input: [[3, 2, 3, 1, 2, 4, 5, 5, 6], 4], expected: 4, sample: true },
      { input: [[1], 1], expected: 1, label: "single element" },
      { input: [[2, 1], 2], expected: 1, label: "k equals length" },
      { input: [[7, 7, 7], 2], expected: 7, label: "all same" },
      { input: [[-1, -5, -3], 1], expected: -1, label: "negatives" },
      { input: [[5, 4, 3, 2, 1], 3], expected: 3, label: "sorted descending" },
      { input: [[1, 2, 2, 2, 3], 4], expected: 2, label: "duplicates" },
      { input: [bigUnsorted, 1234], expected: kthLargestBrute(bigUnsorted, 1234), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Google", "Microsoft", "LinkedIn"],
    source: {
      name: "LeetCode 215. Kth Largest Element in an Array",
      url: "https://leetcode.com/problems/kth-largest-element-in-an-array/",
    },
    reference: `function findKthLargest(nums, k) {
  const h = [];
  const push = (x) => {
    h.push(x);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p] <= h[i]) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  };
  const pop = () => {
    const last = h.pop();
    if (!h.length) return;
    h[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < h.length && h[l] < h[m]) m = l;
      if (r < h.length && h[r] < h[m]) m = r;
      if (m === i) break;
      [h[m], h[i]] = [h[i], h[m]];
      i = m;
    }
  };
  for (const x of nums) {
    push(x);
    if (h.length > k) pop();
  }
  return h[0];
}`,
  },
  {
    slug: "cooldown-job-runner",
    title: "Cooldown Job Runner",
    pattern: "heap",
    difficulty: "medium",
    rating: 1400,
    statement: `A single machine must run a list of jobs. Each job is labeled by an uppercase letter in \`tasks\`, and each job takes one time slot. Two jobs with the same label must be separated by at least \`n\` slots in which the machine runs other jobs or sits idle. Jobs can run in any order.

Return the fewest time slots needed to finish all the jobs.`,
    constraints: ["1 <= tasks.length <= 10^4", "tasks[i] is an uppercase English letter.", "0 <= n <= 100"],
    hints: [
      "The most frequent label is the bottleneck. Picture its copies laid out with gaps of n between them.",
      "Either simulate with a max-heap of remaining counts and a cooldown queue, or count: if the top label appears maxC times and c labels share that count, the answer is max(len(tasks), (maxC - 1) * (n + 1) + c).",
      "count = Counter(tasks)\nmax_c = max(count.values())\nties = sum(1 for v in count.values() if v == max_c)\nreturn max(len(tasks), (max_c - 1) * (n + 1) + ties)",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "leastInterval",
      params: [
        { name: "tasks", type: "string[]" },
        { name: "n", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: [["A", "A", "A", "B", "B", "B"], 2], expected: 8, sample: true },
      { input: [["A", "C", "A", "B", "D", "B"], 1], expected: 6, sample: true },
      { input: [["A", "A", "A", "B", "B", "B"], 3], expected: 10, label: "long cooldown" },
      { input: [["A", "A", "A", "B", "B", "B"], 0], expected: 6, label: "no cooldown" },
      { input: [["A"], 5], expected: 1, label: "single job" },
      { input: [["A", "A", "A"], 2], expected: 7, label: "one label only" },
      { input: [["A", "A", "A", "A", "A", "A", "B", "C", "D", "E", "F", "G"], 2], expected: 16, label: "one dominant label" },
      { input: [["A", "B", "C", "D", "E", "A", "B", "C", "D", "E"], 4], expected: 10, label: "fills every gap" },
      { input: [bigTasks, 7], expected: bruteSchedule(bigTasks, 7), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Microsoft", "Google", "Uber"],
    source: { name: "LeetCode 621. Task Scheduler", url: "https://leetcode.com/problems/task-scheduler/" },
    reference: `function leastInterval(tasks, n) {
  const count = new Map();
  for (const t of tasks) count.set(t, (count.get(t) || 0) + 1);
  const maxC = Math.max(...count.values());
  let ties = 0;
  for (const c of count.values()) if (c === maxC) ties++;
  return Math.max(tasks.length, (maxC - 1) * (n + 1) + ties);
}`,
  },
  {
    slug: "one-core-job-order",
    title: "One-Core Job Order",
    pattern: "heap",
    difficulty: "medium",
    rating: 1500,
    statement: `A single-core processor receives \`n\` jobs, numbered \`0\` to \`n - 1\`. Job \`i\` is \`tasks[i] = [enqueueTime, processingTime]\`: it becomes available at time \`enqueueTime\` and needs \`processingTime\` units to finish once started.

The processor works like this:

- If it is idle and no job is available, it waits until the next job becomes available.
- If it is idle and jobs are available, it starts the one with the **shortest processing time**; ties go to the **smallest index**.
- Once started, a job runs to completion without interruption, and the processor can start the next job at the instant the previous one finishes.

Return the order in which the processor runs the jobs, as a list of indices.`,
    constraints: ["1 <= n <= 10^5", "1 <= enqueueTime, processingTime <= 10^9"],
    hints: [
      "Sort the jobs by when they arrive, and keep track of the current time. Which jobs are you choosing between at any moment?",
      "Sort indices by enqueue time. Keep a min-heap of available jobs keyed by (processingTime, index). Whenever the processor is free, push every job that has arrived; if the heap is empty, jump the clock to the next arrival; otherwise pop and run the top job.",
      "order = sorted(range(n), key=lambda i: tasks[i][0])\nheap, res, time, j = [], [], 0, 0\nwhile len(res) < n:\n    if not heap and time < tasks[order[j]][0]: time = tasks[order[j]][0]\n    while j < n and tasks[order[j]][0] <= time:\n        heappush(heap, (tasks[order[j]][1], order[j])); j += 1\n    p, i = heappop(heap)\n    time += p; res.append(i)\nreturn res",
    ],
    complexity: { time: "O(n log n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "getOrder",
      params: [{ name: "tasks", type: "int[][]" }],
      returns: "int[]",
    },
    tests: [
      { input: [[[1, 2], [2, 4], [3, 2], [4, 1]]], expected: [0, 2, 3, 1], sample: true },
      { input: [[[7, 10], [7, 12], [7, 5], [7, 4], [7, 2]]], expected: [4, 3, 2, 0, 1], sample: true },
      { input: [[[5, 5]]], expected: [0], label: "single job" },
      { input: [[[1, 3], [1, 3], [1, 3]]], expected: [0, 1, 2], label: "ties go to the smaller index" },
      { input: [[[1, 1], [10, 1], [20, 1]]], expected: [0, 1, 2], label: "idle gaps" },
      { input: [[[3, 1], [1, 5], [2, 1]]], expected: [1, 0, 2], label: "first arrival runs first, then index breaks the tie" },
      { input: [[[1, 10], [2, 1], [3, 1], [4, 5]]], expected: [0, 1, 2, 3], label: "jobs queue up during a long job" },
      { input: [[[1000000000, 1000000000], [1, 1]]], expected: [1, 0], label: "extreme values" },
      { input: [bigJobs], expected: bruteCpuOrder(bigJobs), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Microsoft"],
    source: { name: "LeetCode 1834. Single-Threaded CPU", url: "https://leetcode.com/problems/single-threaded-cpu/" },
    reference: `function getOrder(tasks) {
  const n = tasks.length;
  const order = [...tasks.keys()].sort((a, b) => tasks[a][0] - tasks[b][0] || a - b);
  const less = (a, b) => tasks[a][1] < tasks[b][1] || (tasks[a][1] === tasks[b][1] && a < b);
  const h = [];
  const push = (x) => {
    h.push(x);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(h[i], h[p])) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && less(h[l], h[m])) m = l;
        if (r < h.length && less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  };
  const res = [];
  let time = 0, j = 0;
  while (res.length < n) {
    if (!h.length && time < tasks[order[j]][0]) time = tasks[order[j]][0];
    while (j < n && tasks[order[j]][0] <= time) push(order[j++]);
    const i = pop();
    time += tasks[i][1];
    res.push(i);
  }
  return res;
}`,
  },
  {
    slug: "grow-the-startup-fund",
    title: "Grow the Startup Fund",
    pattern: "heap",
    difficulty: "hard",
    rating: 1650,
    statement: `A small company starts with capital \`w\` and may complete at most \`k\` distinct projects before going public. Project \`i\` requires capital \`capital[i]\` to start (the capital is not spent) and, once finished, adds a pure profit of \`profits[i]\` to the company's capital.

Choose the projects, one after another, to maximize the final capital, and return that maximum.`,
    constraints: [
      "1 <= k <= 10^5",
      "0 <= w <= 10^9",
      "1 <= profits.length == capital.length <= 10^5",
      "0 <= profits[i] <= 10^4; 0 <= capital[i] <= 10^9",
    ],
    hints: [
      "Profits only add to your capital, so taking a project never hurts. Among the projects you can afford right now, which one should you take?",
      "Greedy: always take the most profitable affordable project. Sort projects by required capital; each round, move every newly affordable project into a max-heap of profits, then pop the best. Stop early if the heap is empty.",
      "projects = sorted(zip(capital, profits)); heap = []; i = 0\nfor _ in range(k):\n    while i < len(projects) and projects[i][0] <= w:\n        heappush(heap, -projects[i][1]); i += 1\n    if not heap: break\n    w -= heappop(heap)\nreturn w",
    ],
    complexity: { time: "O(n log n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "findMaximizedCapital",
      params: [
        { name: "k", type: "int" },
        { name: "w", type: "int" },
        { name: "profits", type: "int[]" },
        { name: "capital", type: "int[]" },
      ],
      returns: "int",
    },
    tests: [
      { input: [2, 0, [1, 2, 3], [0, 1, 1]], expected: 4, sample: true },
      { input: [3, 0, [1, 2, 3], [0, 1, 2]], expected: 6, sample: true },
      { input: [1, 0, [1, 2, 3], [1, 1, 2]], expected: 0, label: "nothing affordable" },
      { input: [10, 5, [1, 2], [0, 0]], expected: 8, label: "k larger than the project count" },
      { input: [1, 2, [1, 2, 3], [1, 1, 2]], expected: 5, label: "pick the best affordable" },
      { input: [2, 1, [5, 1, 100], [0, 0, 6]], expected: 106, label: "unlock an expensive project" },
      { input: [3, 0, [0, 0, 0], [0, 0, 0]], expected: 0, label: "zero profits" },
      { input: [1, 1000000000, [10000], [1000000000]], expected: 1000010000, label: "extreme values" },
      { input: [40, 0, ipoProfits, ipoCapital], expected: bruteCapital(40, 0, ipoProfits, ipoCapital), label: "large input" },
      { input: [500, 0, ipoProfits, ipoCapital], expected: bruteCapital(500, 0, ipoProfits, ipoCapital), label: "large input, take everything" },
    ],
    companies: ["Amazon", "Google", "Meta"],
    source: { name: "LeetCode 502. IPO", url: "https://leetcode.com/problems/ipo/" },
    reference: `function findMaximizedCapital(k, w, profits, capital) {
  const projects = profits.map((p, i) => [capital[i], p]).sort((a, b) => a[0] - b[0]);
  const h = [];
  const push = (x) => {
    h.push(x);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p] >= h[i]) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && h[l] > h[m]) m = l;
        if (r < h.length && h[r] > h[m]) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  };
  let i = 0;
  for (let r = 0; r < k; r++) {
    while (i < projects.length && projects[i][0] <= w) push(projects[i++][1]);
    if (!h.length) break;
    w += pop();
  }
  return w;
}`,
  },
];
