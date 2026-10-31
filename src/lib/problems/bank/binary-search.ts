import type { Problem } from "../types";

const evens = Array.from({ length: 2000 }, (_, i) => 2 * i);
// 0..1999 rotated so that it starts at 1300.
const rotated = Array.from({ length: 2000 }, (_, i) => (i + 1300) % 2000);

function bruteMedian(a: number[], b: number[]): number {
  const all = [...a, ...b].sort((x, y) => x - y);
  const m = all.length >> 1;
  return all.length % 2 ? all[m] : (all[m - 1] + all[m]) / 2;
}

// A 40 x 50 matrix of increasing odd numbers, row after row.
const bigMatrix = Array.from({ length: 40 }, (_, r) => Array.from({ length: 50 }, (_, c) => 2 * (r * 50 + c) + 1));
const oddsA = Array.from({ length: 1500 }, (_, i) => 3 * i + 1);
const oddsB = Array.from({ length: 1201 }, (_, i) => 5 * i - 700);

// A long TimeMap session: keys k0..k9 set at increasing timestamps, then probed.
const timeLog = (() => {
  const ops: string[] = ["TimeMap"];
  const args: unknown[][] = [[]];
  const expected: (string | null)[] = [null];
  const history = new Map<string, [number, string][]>();
  for (let t = 1; t <= 600; t++) {
    const key = `k${(t * 7) % 10}`;
    if (t % 3 === 0) {
      const value = `v${t}`;
      ops.push("set");
      args.push([key, value, t * 2]);
      expected.push(null);
      if (!history.has(key)) history.set(key, []);
      history.get(key)!.push([t * 2, value]);
    } else {
      const at = t * 2 - (t % 5);
      ops.push("get");
      args.push([key, at]);
      let found = "";
      for (const [ts, v] of history.get(key) ?? []) if (ts <= at) found = v;
      expected.push(found);
    }
  }
  return { input: [ops, args], expected };
})();

export const binarySearch: Problem[] = [
  {
    slug: "find-in-sorted-list",
    title: "Find in a Sorted List",
    pattern: "binary-search",
    difficulty: "easy",
    rating: 950,
    statement: `You are given an array \`nums\` of distinct integers sorted in increasing order, and an integer \`target\`.

Return the index of \`target\` in \`nums\`, or \`-1\` if it is not there. Your solution must run in O(log n) time.`,
    constraints: [
      "1 <= nums.length <= 10^4",
      "-10^4 <= nums[i], target <= 10^4",
      "All values in nums are distinct and sorted in increasing order.",
    ],
    hints: [
      "Comparing target with the middle element tells you which half cannot contain it.",
      "Keep a range [lo, hi]. Look at mid; if it matches, return it, otherwise discard the half that is too small or too large. Stop when the range is empty.",
      "lo, hi = 0, len(nums) - 1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    if nums[mid] == target: return mid\n    if nums[mid] < target: lo = mid + 1\n    else: hi = mid - 1\nreturn -1",
    ],
    complexity: { time: "O(log n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "search",
      params: [
        { name: "nums", type: "int[]" },
        { name: "target", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: [[-1, 0, 3, 5, 9, 12], 9], expected: 4, sample: true },
      { input: [[-1, 0, 3, 5, 9, 12], 2], expected: -1, sample: true },
      { input: [[5], 5], expected: 0, label: "single element, found" },
      { input: [[5], -5], expected: -1, label: "single element, missing" },
      { input: [[1, 3], 3], expected: 1, label: "last element" },
      { input: [[-10, -5, 0], -10], expected: 0, label: "negatives, first element" },
      { input: [[2, 4, 6], 7], expected: -1, label: "larger than all" },
      { input: [evens, 1234], expected: 617, label: "large input, found" },
      { input: [evens, 1235], expected: -1, label: "large input, missing" },
    ],
    companies: ["Google", "Microsoft", "Amazon", "Apple"],
    source: { name: "LeetCode 704. Binary Search", url: "https://leetcode.com/problems/binary-search/" },
    reference: `function search(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
  },
  {
    slug: "steady-snacking-speed",
    title: "Steady Snacking Speed",
    pattern: "binary-search",
    difficulty: "medium",
    rating: 1350,
    statement: `A raccoon has found several piles of berries; pile \`i\` holds \`piles[i]\` berries. It picks a fixed eating speed of \`k\` berries per hour. Each hour it chooses one pile and eats \`k\` berries from it; if the pile has fewer than \`k\` left, it finishes that pile and waits out the rest of the hour without touching another pile.

The raccoon must finish every pile within \`h\` hours. Return the smallest whole-number speed \`k\` that makes this possible. It is guaranteed that \`h >= piles.length\`.`,
    constraints: [
      "1 <= piles.length <= 10^4",
      "piles.length <= h <= 10^9",
      "1 <= piles[i] <= 10^9",
    ],
    hints: [
      "If speed k is fast enough, every speed above k is also fast enough. What does that monotonic yes/no shape let you do?",
      "Binary search on k between 1 and max(piles). For a candidate k, the hours needed are the sum of ceil(pile / k); keep the smallest k whose total is at most h.",
      "lo, hi = 1, max(piles)\nwhile lo < hi:\n    k = (lo + hi) // 2\n    if sum((p + k - 1) // k for p in piles) <= h: hi = k\n    else: lo = k + 1\nreturn lo",
    ],
    complexity: { time: "O(n log m)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "minEatingSpeed",
      params: [
        { name: "piles", type: "int[]" },
        { name: "h", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: [[3, 6, 7, 11], 8], expected: 4, sample: true },
      { input: [[30, 11, 23, 4, 20], 5], expected: 30, sample: true },
      { input: [[30, 11, 23, 4, 20], 6], expected: 23, label: "one spare hour" },
      { input: [[1], 1], expected: 1, label: "single pile" },
      { input: [[1000000000], 2], expected: 500000000, label: "huge pile" },
      { input: [[312884470], 968709470], expected: 1, label: "plenty of time" },
      { input: [[5, 5, 5], 3], expected: 5, label: "all same, no slack" },
      { input: [[2, 2], 4], expected: 1, label: "slowest speed" },
      { input: [Array.from({ length: 1000 }, () => 10), 2000], expected: 5, label: "large input" },
    ],
    companies: ["Amazon", "Google", "Meta", "Airbnb"],
    source: {
      name: "LeetCode 875. Koko Eating Bananas",
      url: "https://leetcode.com/problems/koko-eating-bananas/",
    },
    reference: `function minEatingSpeed(piles, h) {
  let lo = 1, hi = Math.max(...piles);
  while (lo < hi) {
    const k = Math.floor((lo + hi) / 2);
    let hours = 0;
    for (const p of piles) hours += Math.ceil(p / k);
    if (hours <= h) hi = k;
    else lo = k + 1;
  }
  return lo;
}`,
  },
  {
    slug: "search-a-rotated-list",
    title: "Search a Rotated List",
    pattern: "binary-search",
    difficulty: "medium",
    rating: 1500,
    statement: `An increasing array of distinct integers was cut at some unknown position and the two parts were swapped, so \`[0, 1, 2, 4, 5, 6, 7]\` might become \`[4, 5, 6, 7, 0, 1, 2]\`. The cut may also have been at position 0, leaving the array unchanged.

Given the resulting array \`nums\` and an integer \`target\`, return the index of \`target\` in \`nums\`, or \`-1\` if it is absent. Your solution must run in O(log n) time.`,
    constraints: [
      "1 <= nums.length <= 5000",
      "-10^4 <= nums[i], target <= 10^4",
      "All values in nums are distinct.",
    ],
    hints: [
      "Split the array at mid. At least one of the two halves is sorted in the ordinary way. Can you tell which?",
      "If nums[lo] <= nums[mid], the left half is sorted: check whether target lies in [nums[lo], nums[mid]) to decide which way to go. Otherwise the right half is sorted; use (nums[mid], nums[hi]].",
      "while lo <= hi:\n    mid = (lo + hi) // 2\n    if nums[mid] == target: return mid\n    if nums[lo] <= nums[mid]:\n        if nums[lo] <= target < nums[mid]: hi = mid - 1\n        else: lo = mid + 1\n    else:\n        if nums[mid] < target <= nums[hi]: lo = mid + 1\n        else: hi = mid - 1\nreturn -1",
    ],
    complexity: { time: "O(log n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "search",
      params: [
        { name: "nums", type: "int[]" },
        { name: "target", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: [[4, 5, 6, 7, 0, 1, 2], 0], expected: 4, sample: true },
      { input: [[4, 5, 6, 7, 0, 1, 2], 3], expected: -1, sample: true },
      { input: [[1], 0], expected: -1, label: "single element, missing" },
      { input: [[1], 1], expected: 0, label: "single element, found" },
      { input: [[3, 1], 1], expected: 1, label: "two elements" },
      { input: [[5, 1, 3], 5], expected: 0, label: "target at the start" },
      { input: [[1, 3, 5], 5], expected: 2, label: "not rotated" },
      { input: [[6, 7, 1, 2, 3, 4, 5], 7], expected: 1, label: "short left part" },
      { input: [[-3, -1, -10, -7], -7], expected: 3, label: "negatives" },
      { input: [rotated, 1299], expected: 1999, label: "large input" },
      { input: [rotated, 2000], expected: -1, label: "large input, missing" },
    ],
    companies: ["Meta", "Amazon", "Microsoft", "LinkedIn", "Google"],
    source: {
      name: "LeetCode 33. Search in Rotated Sorted Array",
      url: "https://leetcode.com/problems/search-in-rotated-sorted-array/",
    },
    reference: `function search(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] === target) return mid;
    if (nums[lo] <= nums[mid]) {
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return -1;
}`,
  },
  {
    slug: "where-it-would-go",
    title: "Where It Would Go",
    pattern: "binary-search",
    difficulty: "easy",
    rating: 1000,
    statement: `You are given a sorted array of distinct integers \`nums\` and a value \`target\`. If \`target\` is in the array, return its index. Otherwise return the index where it would have to be inserted to keep the array sorted.

Your solution must run in O(log n) time.`,
    constraints: ["1 <= nums.length <= 10^4", "-10^4 <= nums[i], target <= 10^4", "nums is sorted and its values are distinct."],
    hints: [
      "Both cases ask the same question: what is the first index whose value is at least target?",
      "Binary search over [0, n]. If nums[mid] < target the answer is to the right of mid; otherwise mid itself could be the answer, so keep it in range.",
      "lo, hi = 0, len(nums)\nwhile lo < hi:\n    mid = (lo + hi) // 2\n    if nums[mid] < target: lo = mid + 1\n    else: hi = mid\nreturn lo",
    ],
    complexity: { time: "O(log n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "searchInsert",
      params: [
        { name: "nums", type: "int[]" },
        { name: "target", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: [[1, 3, 5, 6], 5], expected: 2, sample: true },
      { input: [[1, 3, 5, 6], 2], expected: 1, sample: true },
      { input: [[1, 3, 5, 6], 7], expected: 4, label: "past the end" },
      { input: [[1, 3, 5, 6], 0], expected: 0, label: "before the start" },
      { input: [[4], 4], expected: 0, label: "single element, found" },
      { input: [[4], 9], expected: 1, label: "single element, after" },
      { input: [[-10, -5, 0, 5], -7], expected: 1, label: "negatives" },
      { input: [[1, 3, 5, 6], 6], expected: 3, label: "last element" },
      { input: [evens, 2999], expected: 1500, label: "large, missing" },
      { input: [evens, 3998], expected: 1999, label: "large, found" },
    ],
    companies: ["Amazon", "Google", "Apple", "Bloomberg"],
    source: { name: "LeetCode 35. Search Insert Position", url: "https://leetcode.com/problems/search-insert-position/" },
    reference: `function searchInsert(nums, target) {
  let lo = 0, hi = nums.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}`,
  },
  {
    slug: "search-the-sorted-grid",
    title: "Search the Sorted Grid",
    pattern: "binary-search",
    difficulty: "medium",
    rating: 1200,
    statement: `An \`m x n\` integer grid \`matrix\` has two properties: each row is sorted in non-decreasing order, and the first value of each row is greater than the last value of the row above it.

Given an integer \`target\`, return \`true\` if it appears in the grid and \`false\` otherwise, in O(log(m·n)) time.`,
    constraints: ["1 <= m, n <= 100", "-10^4 <= matrix[i][j], target <= 10^4"],
    hints: [
      "Read the grid row after row. What does the sequence of values look like?",
      "Treat the grid as one sorted array of length m·n. Index k maps to row k // n and column k % n, so an ordinary binary search works.",
      "lo, hi = 0, m * n - 1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    v = matrix[mid // n][mid % n]\n    if v == target: return True\n    if v < target: lo = mid + 1\n    else: hi = mid - 1\nreturn False",
    ],
    complexity: { time: "O(log(m·n))", space: "O(1)" },
    signature: {
      kind: "function",
      name: "searchMatrix",
      params: [
        { name: "matrix", type: "int[][]" },
        { name: "target", type: "int" },
      ],
      returns: "bool",
    },
    tests: [
      { input: [[[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 3], expected: true, sample: true },
      { input: [[[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 13], expected: false, sample: true },
      { input: [[[5]], 5], expected: true, label: "single cell" },
      { input: [[[5]], 4], expected: false, label: "single cell, missing" },
      { input: [[[1], [3], [5]], 3], expected: true, label: "single column" },
      { input: [[[1, 2, 3, 4]], 4], expected: true, label: "single row, last" },
      { input: [[[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 60], expected: true, label: "bottom-right corner" },
      { input: [[[1, 3], [5, 7]], 0], expected: false, label: "smaller than everything" },
      { input: [[[-9, -4], [-1, 0]], -4], expected: true, label: "negatives" },
      { input: [bigMatrix, 2501], expected: true, label: "large, found" },
      { input: [bigMatrix, 2500], expected: false, label: "large, missing" },
    ],
    companies: ["Amazon", "Microsoft", "Meta", "Bloomberg"],
    source: { name: "LeetCode 74. Search a 2D Matrix", url: "https://leetcode.com/problems/search-a-2d-matrix/" },
    reference: `function searchMatrix(matrix, target) {
  const m = matrix.length, n = matrix[0].length;
  let lo = 0, hi = m * n - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = matrix[Math.floor(mid / n)][mid % n];
    if (v === target) return true;
    if (v < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}`,
  },
  {
    slug: "lowest-after-rotation",
    title: "Lowest After Rotation",
    pattern: "binary-search",
    difficulty: "medium",
    rating: 1300,
    statement: `A sorted array of distinct integers was rotated: some prefix was cut off and moved to the end, so \`[0, 1, 2, 4, 5, 6, 7]\` might have become \`[4, 5, 6, 7, 0, 1, 2]\`. It may also have been rotated by zero positions.

Given the rotated array \`nums\`, return its smallest value in O(log n) time.`,
    constraints: ["1 <= nums.length <= 5000", "-5000 <= nums[i] <= 5000", "All values are distinct; nums is a rotated sorted array."],
    hints: [
      "Compare the middle value with the last value. What does that tell you about where the drop happens?",
      "If nums[mid] > nums[hi], the minimum lies strictly to the right of mid. Otherwise it is at mid or to its left. Shrink the range until one element remains.",
      "lo, hi = 0, len(nums) - 1\nwhile lo < hi:\n    mid = (lo + hi) // 2\n    if nums[mid] > nums[hi]: lo = mid + 1\n    else: hi = mid\nreturn nums[lo]",
    ],
    complexity: { time: "O(log n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "findMin",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[3, 4, 5, 1, 2]], expected: 1, sample: true },
      { input: [[4, 5, 6, 7, 0, 1, 2]], expected: 0, sample: true },
      { input: [[11, 13, 15, 17]], expected: 11, label: "not rotated" },
      { input: [[1]], expected: 1, label: "single element" },
      { input: [[2, 1]], expected: 1, label: "two elements" },
      { input: [[5, 1, 2, 3, 4]], expected: 1, label: "rotated by one less than n" },
      { input: [[2, 3, 4, 5, 1]], expected: 1, label: "minimum at the end" },
      { input: [[-1, -5000, -3000]], expected: -5000, label: "negatives" },
      { input: [rotated], expected: 0, label: "large input" },
    ],
    companies: ["Amazon", "Microsoft", "Meta", "Google"],
    source: {
      name: "LeetCode 153. Find Minimum in Rotated Sorted Array",
      url: "https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/",
    },
    reference: `function findMin(nums) {
  let lo = 0, hi = nums.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] > nums[hi]) lo = mid + 1;
    else hi = mid;
  }
  return nums[lo];
}`,
  },
  {
    slug: "versioned-key-store",
    title: "Versioned Key Store",
    pattern: "binary-search",
    difficulty: "medium",
    rating: 1450,
    statement: `Design a class \`TimeMap\` that stores several versions of a value per key, each stamped with a time, and can answer "what was the value at time t?".

- \`TimeMap()\` creates an empty store.
- \`set(key, value, timestamp)\` records \`value\` for \`key\` at \`timestamp\`.
- \`get(key, timestamp)\` returns the value recorded for \`key\` at the largest timestamp that is \`<= timestamp\`. If there is none, return the empty string \`""\`.

Calls to \`set\` arrive with strictly increasing timestamps.`,
    constraints: [
      "1 <= key.length, value.length <= 100; keys and values are lowercase letters and digits.",
      "1 <= timestamp <= 10^7; set timestamps are strictly increasing.",
      "At most 2 * 10^5 calls in total.",
    ],
    hints: [
      "Because set timestamps only increase, the versions of each key are already stored in sorted order.",
      "Keep a map from key to a list of (timestamp, value) pairs. For get, binary search that key's list for the last timestamp that is <= the query.",
      "set: store[key].append((timestamp, value))\nget:\n    arr = store.get(key, []); lo, hi, ans = 0, len(arr) - 1, ''\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if arr[mid][0] <= timestamp: ans = arr[mid][1]; lo = mid + 1\n        else: hi = mid - 1\n    return ans",
    ],
    complexity: { time: "O(log n)", space: "O(n)" },
    signature: {
      kind: "design",
      className: "TimeMap",
      constructorParams: [],
      methods: [
        {
          name: "set",
          params: [
            { name: "key", type: "string" },
            { name: "value", type: "string" },
            { name: "timestamp", type: "int" },
          ],
          returns: "void",
        },
        {
          name: "get",
          params: [
            { name: "key", type: "string" },
            { name: "timestamp", type: "int" },
          ],
          returns: "string",
        },
      ],
    },
    tests: [
      {
        input: [
          ["TimeMap", "set", "get", "get", "set", "get", "get"],
          [[], ["foo", "bar", 1], ["foo", 1], ["foo", 3], ["foo", "bar2", 4], ["foo", 4], ["foo", 5]],
        ],
        expected: [null, null, "bar", "bar", null, "bar2", "bar2"],
        sample: true,
      },
      {
        input: [
          ["TimeMap", "set", "set", "get", "get"],
          [[], ["a", "x", 10], ["b", "y", 20], ["a", 15], ["b", 15]],
        ],
        expected: [null, null, null, "x", ""],
        sample: true,
      },
      {
        input: [["TimeMap", "get"], [[], ["ghost", 5]]],
        expected: [null, ""],
        label: "unknown key",
      },
      {
        input: [
          ["TimeMap", "set", "get"],
          [[], ["k", "v", 5], ["k", 4]],
        ],
        expected: [null, null, ""],
        label: "query before first version",
      },
      {
        input: [
          ["TimeMap", "set", "set", "set", "get", "get", "get"],
          [[], ["k", "one", 1], ["k", "two", 2], ["k", "three", 3], ["k", 1], ["k", 2], ["k", 3]],
        ],
        expected: [null, null, null, null, "one", "two", "three"],
        label: "exact timestamps",
      },
      {
        input: [
          ["TimeMap", "set", "set", "get", "get"],
          [[], ["love", "high", 10], ["love", "low", 20], ["love", 5], ["love", 25]],
        ],
        expected: [null, null, null, "", "low"],
        label: "before and after all versions",
      },
      {
        input: [
          ["TimeMap", "set", "set", "set", "get"],
          [[], ["k", "a", 1], ["k", "b", 100], ["k", "c", 10000000], ["k", 9999999]],
        ],
        expected: [null, null, null, null, "b"],
        label: "wide gaps",
      },
      { input: timeLog.input, expected: timeLog.expected, label: "long session" },
    ],
    companies: ["Google", "Amazon", "Uber", "Airbnb", "Meta"],
    source: { name: "LeetCode 981. Time Based Key-Value Store", url: "https://leetcode.com/problems/time-based-key-value-store/" },
    reference: `class TimeMap {
  constructor() {
    this.store = new Map();
  }
  set(key, value, timestamp) {
    if (!this.store.has(key)) this.store.set(key, []);
    this.store.get(key).push([timestamp, value]);
  }
  get(key, timestamp) {
    const arr = this.store.get(key) || [];
    let lo = 0, hi = arr.length - 1, ans = "";
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid][0] <= timestamp) {
        ans = arr[mid][1];
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }
}`,
  },
  {
    slug: "middle-of-two-sorted-lists",
    title: "Middle of Two Sorted Lists",
    pattern: "binary-search",
    difficulty: "hard",
    rating: 1800,
    statement: `You are given two sorted integer arrays \`nums1\` and \`nums2\`, of lengths \`m\` and \`n\`. Return the median of all \`m + n\` values taken together: the middle value if the total count is odd, or the average of the two middle values if it is even.

Your solution should run in O(log(min(m, n))) time, so merging the arrays is not the intended approach. Answers within \`10^-5\` are accepted.`,
    constraints: [
      "0 <= m, n <= 1000",
      "1 <= m + n <= 2000 (larger in the big test)",
      "-10^6 <= nums1[i], nums2[i] <= 10^6",
    ],
    hints: [
      "The median splits the combined values into a left half and a right half. If you knew how many of the left half come from nums1, you would know how many come from nums2.",
      "Binary search on i, the number of elements taken from the shorter array (j = half - i from the other). The split is right when nums1[i - 1] <= nums2[j] and nums2[j - 1] <= nums1[i]; treat missing neighbors as -inf / +inf.",
      "if len(a) > len(b): a, b = b, a\nm, n = len(a), len(b); half = (m + n + 1) // 2\nlo, hi = 0, m\nwhile lo <= hi:\n    i = (lo + hi) // 2; j = half - i\n    aL = a[i - 1] if i > 0 else -inf; aR = a[i] if i < m else inf\n    bL = b[j - 1] if j > 0 else -inf; bR = b[j] if j < n else inf\n    if aL <= bR and bL <= aR:\n        if (m + n) % 2: return max(aL, bL)\n        return (max(aL, bL) + min(aR, bR)) / 2\n    if aL > bR: hi = i - 1\n    else: lo = i + 1",
    ],
    complexity: { time: "O(log(min(m, n)))", space: "O(1)" },
    signature: {
      kind: "function",
      name: "findMedianSortedArrays",
      params: [
        { name: "nums1", type: "int[]" },
        { name: "nums2", type: "int[]" },
      ],
      returns: "float",
      compare: "float",
    },
    tests: [
      { input: [[1, 3], [2]], expected: 2, sample: true },
      { input: [[1, 2], [3, 4]], expected: 2.5, sample: true },
      { input: [[], [1]], expected: 1, label: "first array empty" },
      { input: [[2], []], expected: 2, label: "second array empty" },
      { input: [[0, 0], [0, 0]], expected: 0, label: "all equal" },
      { input: [[1, 2, 3], [4, 5, 6, 7]], expected: 4, label: "no overlap" },
      { input: [[1, 5, 9], [2, 3, 4, 6]], expected: 4, label: "interleaved" },
      { input: [[-5, -3, -1], [-2]], expected: -2.5, label: "negatives" },
      { input: [[100], [1, 2, 3, 4, 5, 6]], expected: 4, label: "very different lengths" },
      { input: [[1, 1, 1], [1, 1, 2]], expected: 1, label: "duplicates" },
      { input: [oddsA, oddsB], expected: bruteMedian(oddsA, oddsB), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Microsoft", "Apple", "Goldman Sachs"],
    source: { name: "LeetCode 4. Median of Two Sorted Arrays", url: "https://leetcode.com/problems/median-of-two-sorted-arrays/" },
    reference: `function findMedianSortedArrays(nums1, nums2) {
  let a = nums1, b = nums2;
  if (a.length > b.length) [a, b] = [b, a];
  const m = a.length, n = b.length, half = (m + n + 1) >> 1;
  let lo = 0, hi = m;
  while (lo <= hi) {
    const i = (lo + hi) >> 1, j = half - i;
    const aL = i > 0 ? a[i - 1] : -Infinity, aR = i < m ? a[i] : Infinity;
    const bL = j > 0 ? b[j - 1] : -Infinity, bR = j < n ? b[j] : Infinity;
    if (aL <= bR && bL <= aR) {
      if ((m + n) % 2) return Math.max(aL, bL);
      return (Math.max(aL, bL) + Math.min(aR, bR)) / 2;
    }
    if (aL > bR) hi = i - 1;
    else lo = i + 1;
  }
  return 0;
}`,
  },
];
