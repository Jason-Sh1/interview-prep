import type { Problem } from "../types";

const evens = Array.from({ length: 2000 }, (_, i) => 2 * i);
// 0..1999 rotated so that it starts at 1300.
const rotated = Array.from({ length: 2000 }, (_, i) => (i + 1300) % 2000);

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
];
