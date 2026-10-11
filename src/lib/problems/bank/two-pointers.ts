import type { Problem } from "../types";

// Deterministic pseudo-random heights for the large tests.
const heights = (n: number, mod: number) => Array.from({ length: n }, (_, i) => (i * 37 + 11) % mod);

function bruteMaxArea(h: number[]): number {
  let best = 0;
  for (let i = 0; i < h.length; i++)
    for (let j = i + 1; j < h.length; j++) best = Math.max(best, Math.min(h[i], h[j]) * (j - i));
  return best;
}

function bruteTrap(h: number[]): number {
  let total = 0;
  for (let i = 0; i < h.length; i++) {
    let left = 0;
    let right = 0;
    for (let j = 0; j <= i; j++) left = Math.max(left, h[j]);
    for (let j = i; j < h.length; j++) right = Math.max(right, h[j]);
    total += Math.min(left, right) - h[i];
  }
  return total;
}

const bigContainer = heights(800, 1000);
const bigTerrain = heights(1500, 97);

export const twoPointers: Problem[] = [
  {
    slug: "mirror-phrase-check",
    title: "Mirror Phrase Check",
    pattern: "two-pointers",
    difficulty: "easy",
    rating: 1000,
    statement: `A phrase reads the same both ways if, after throwing away every character that is not a letter or a digit and treating upper- and lowercase letters as equal, the remaining characters form the same sequence forwards and backwards.

Given a string \`s\`, return \`true\` if it reads the same both ways and \`false\` otherwise. A string with no letters or digits counts as reading the same both ways.`,
    constraints: ["1 <= s.length <= 2 * 10^5", "s consists of printable ASCII characters."],
    hints: [
      "You do not need to build a cleaned copy of the string. Compare from both ends at once.",
      "Keep a left and a right index. Skip characters that are not alphanumeric on each side, then compare the two characters case-insensitively and move both inward.",
      "i, j = 0, len(s) - 1\nwhile i < j:\n    while i < j and not s[i].isalnum(): i += 1\n    while i < j and not s[j].isalnum(): j -= 1\n    if s[i].lower() != s[j].lower(): return False\n    i += 1; j -= 1\nreturn True",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "isPalindrome",
      params: [{ name: "s", type: "string" }],
      returns: "bool",
    },
    tests: [
      { input: ["A man, a plan, a canal: Panama"], expected: true, sample: true },
      { input: ["race a car"], expected: false, sample: true },
      { input: [" "], expected: true, label: "no alphanumerics" },
      { input: ["a"], expected: true, label: "single character" },
      { input: ["0P"], expected: false, label: "digit vs letter" },
      { input: ["ab_a"], expected: true, label: "underscore is skipped" },
      { input: ["No 'x' in Nixon"], expected: true, label: "mixed case" },
      { input: ["12321"], expected: true, label: "digits" },
      { input: ["aaaa".repeat(500) + "b"], expected: false, label: "large input" },
    ],
    companies: ["Meta", "Microsoft", "Amazon", "Apple"],
    source: { name: "LeetCode 125. Valid Palindrome", url: "https://leetcode.com/problems/valid-palindrome/" },
    reference: `function isPalindrome(s) {
  const ok = (c) => /[a-z0-9]/i.test(c);
  let i = 0, j = s.length - 1;
  while (i < j) {
    while (i < j && !ok(s[i])) i++;
    while (i < j && !ok(s[j])) j--;
    if (s[i].toLowerCase() !== s[j].toLowerCase()) return false;
    i++;
    j--;
  }
  return true;
}`,
  },
  {
    slug: "widest-water-tank",
    title: "Widest Water Tank",
    pattern: "two-pointers",
    difficulty: "medium",
    rating: 1300,
    statement: `A row of vertical posts stands at positions \`0, 1, ..., n - 1\`; post \`i\` has height \`height[i]\`. Pick any two posts: together with the ground they form a tank whose water level cannot rise above the shorter post, and whose width is the distance between the two positions.

Return the largest amount of water (width times level) that any single pair of posts can hold. Posts between the chosen pair do not get in the way.`,
    constraints: ["2 <= height.length <= 10^5", "0 <= height[i] <= 10^4"],
    hints: [
      "Start with the widest possible pair. If you shrink the width, what must change for the area to grow?",
      "Use pointers at both ends. The shorter post limits the area, and moving the taller one can never help, so always move the pointer at the shorter post inward, tracking the best area.",
      "i, j, best = 0, n - 1, 0\nwhile i < j:\n    best = max(best, min(h[i], h[j]) * (j - i))\n    if h[i] < h[j]: i += 1\n    else: j -= 1\nreturn best",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "maxArea",
      params: [{ name: "height", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], expected: 49, sample: true },
      { input: [[1, 1]], expected: 1, sample: true },
      { input: [[4, 3, 2, 1, 4]], expected: 16, label: "tall ends" },
      { input: [[1, 2, 1]], expected: 2, label: "three posts" },
      { input: [[0, 0]], expected: 0, label: "zero heights" },
      { input: [[5, 5, 5, 5]], expected: 15, label: "all same" },
      { input: [[1, 2, 3, 4, 5, 6]], expected: 9, label: "increasing" },
      { input: [bigContainer], expected: bruteMaxArea(bigContainer), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Meta", "Bloomberg", "Goldman Sachs"],
    source: {
      name: "LeetCode 11. Container With Most Water",
      url: "https://leetcode.com/problems/container-with-most-water/",
    },
    reference: `function maxArea(height) {
  let i = 0, j = height.length - 1, best = 0;
  while (i < j) {
    best = Math.max(best, Math.min(height[i], height[j]) * (j - i));
    if (height[i] < height[j]) i++;
    else j--;
  }
  return best;
}`,
  },
  {
    slug: "rainfall-between-ridges",
    title: "Rainfall Between Ridges",
    pattern: "two-pointers",
    difficulty: "hard",
    rating: 1700,
    statement: `An elevation profile is given as an array \`height\` of non-negative integers, where each entry is a column of width 1. After heavy rain, water settles in the dips: above each column, water rises up to the lower of the tallest column on its left and the tallest column on its right (including itself), and any water outside the outermost columns runs off.

Return the total units of water held above all the columns.`,
    constraints: ["0 <= height.length <= 2 * 10^4", "0 <= height[i] <= 10^5"],
    hints: [
      "Water above column i equals min(max to its left, max to its right) - height[i]. Can you know one of those two maxima for sure without the other?",
      "Walk two pointers inward keeping leftMax and rightMax. Whichever side has the smaller max is the limiting side: settle the water on that side and move that pointer.",
      "i, j, lmax, rmax, water = 0, n - 1, 0, 0, 0\nwhile i < j:\n    if h[i] < h[j]:\n        lmax = max(lmax, h[i]); water += lmax - h[i]; i += 1\n    else:\n        rmax = max(rmax, h[j]); water += rmax - h[j]; j -= 1\nreturn water",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "trap",
      params: [{ name: "height", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], expected: 6, sample: true },
      { input: [[4, 2, 0, 3, 2, 5]], expected: 9, sample: true },
      { input: [[]], expected: 0, label: "empty input" },
      { input: [[3]], expected: 0, label: "single column" },
      { input: [[1, 2, 3, 4]], expected: 0, label: "increasing" },
      { input: [[5, 4, 1, 2]], expected: 1, label: "right side limits" },
      { input: [[3, 0, 3]], expected: 3, label: "single dip" },
      { input: [[2, 2, 2]], expected: 0, label: "all same" },
      { input: [bigTerrain], expected: bruteTrap(bigTerrain), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Goldman Sachs", "Meta", "Microsoft"],
    source: { name: "LeetCode 42. Trapping Rain Water", url: "https://leetcode.com/problems/trapping-rain-water/" },
    reference: `function trap(height) {
  let i = 0, j = height.length - 1, lmax = 0, rmax = 0, water = 0;
  while (i < j) {
    if (height[i] < height[j]) {
      lmax = Math.max(lmax, height[i]);
      water += lmax - height[i];
      i++;
    } else {
      rmax = Math.max(rmax, height[j]);
      water += rmax - height[j];
      j--;
    }
  }
  return water;
}`,
  },
];
