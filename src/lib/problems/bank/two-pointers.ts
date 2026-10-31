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

function bruteThreeSum(nums: number[]): number[][] {
  const seen = new Map<string, number[]>();
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++)
      for (let k = j + 1; k < nums.length; k++)
        if (nums[i] + nums[j] + nums[k] === 0) {
          const t = [nums[i], nums[j], nums[k]].sort((a, b) => a - b);
          seen.set(t.join(","), t);
        }
  return [...seen.values()];
}

function brutePairIndices(nums: number[], target: number): number[] {
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++) if (nums[i] + nums[j] === target) return [i + 1, j + 1];
  return [];
}

const squared = (a: number[]) => a.map((x) => x * x).sort((x, y) => x - y);
const zerosMoved = (a: number[]) => [...a.filter((x) => x !== 0), ...a.filter((x) => x === 0)];

// Evens 0..3998 plus one odd value: an odd target forces a unique pair.
const evensWithOdd = [...Array.from({ length: 2000 }, (_, i) => 2 * i), 2501].sort((a, b) => a - b);
const bigTriples = Array.from({ length: 150 }, (_, i) => ((i * 37 + 11) % 61) - 30);
const bigZeros = Array.from({ length: 3000 }, (_, i) => (i % 3 === 0 ? 0 : (i * 13) % 100));
const bigColors = Array.from({ length: 3000 }, (_, i) => (i * 7 + (i >> 2)) % 3);
const bigSorted = Array.from({ length: 3000 }, (_, i) => i - 1700);

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
  {
    slug: "sink-the-zeros",
    title: "Sink the Zeros",
    pattern: "two-pointers",
    difficulty: "easy",
    rating: 920,
    statement: `Given an integer array \`nums\`, move every \`0\` to the end of the array while keeping the other values in their original relative order.

Do it in place, without making a copy of the array. The function returns nothing; the tests read \`nums\` afterwards.`,
    constraints: ["1 <= nums.length <= 10^4", "-2^31 <= nums[i] <= 2^31 - 1"],
    hints: [
      "Think of the front of the array as a growing region that holds the non-zero values found so far.",
      "Keep a write index. Scan with a read index; whenever you read a non-zero value, swap it into the write position and advance the write index. Zeros drift to the back on their own.",
      "w = 0\nfor r in range(len(nums)):\n    if nums[r] != 0:\n        nums[w], nums[r] = nums[r], nums[w]\n        w += 1",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "moveZeroes",
      params: [{ name: "nums", type: "int[]" }],
      returns: "void",
      inPlaceArg: 0,
    },
    tests: [
      { input: [[0, 1, 0, 3, 12]], expected: [1, 3, 12, 0, 0], sample: true },
      { input: [[0]], expected: [0], sample: true },
      { input: [[1, 2, 3]], expected: [1, 2, 3], label: "no zeros" },
      { input: [[0, 0, 0]], expected: [0, 0, 0], label: "all zeros" },
      { input: [[4, 0]], expected: [4, 0], label: "already in place" },
      { input: [[0, 0, 7]], expected: [7, 0, 0], label: "zeros at the front" },
      { input: [[-1, 0, -2, 0, 3]], expected: [-1, -2, 3, 0, 0], label: "negatives" },
      { input: [[2, 2, 0, 2]], expected: [2, 2, 2, 0], label: "duplicates" },
      { input: [bigZeros], expected: zerosMoved(bigZeros), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Microsoft", "Apple", "Bloomberg"],
    source: { name: "LeetCode 283. Move Zeroes", url: "https://leetcode.com/problems/move-zeroes/" },
    reference: `function moveZeroes(nums) {
  let w = 0;
  for (let r = 0; r < nums.length; r++) {
    if (nums[r] !== 0) {
      [nums[w], nums[r]] = [nums[r], nums[w]];
      w++;
    }
  }
}`,
  },
  {
    slug: "squares-in-order",
    title: "Squares in Order",
    pattern: "two-pointers",
    difficulty: "easy",
    rating: 1050,
    statement: `You are given an integer array \`nums\` sorted in non-decreasing order; it may contain negative numbers. Return a new array holding the square of every element, also sorted in non-decreasing order.

Squaring and then sorting is O(n log n). Find an O(n) approach.`,
    constraints: ["1 <= nums.length <= 10^4", "-10^4 <= nums[i] <= 10^4", "nums is sorted in non-decreasing order."],
    hints: [
      "After squaring, where in the original array do the largest values come from?",
      "The biggest square is always at one of the two ends. Compare the absolute values at both ends, write the larger square into the output from the back, and move that pointer inward.",
      "i, j = 0, len(nums) - 1\nout = [0] * len(nums)\nfor w in range(len(nums) - 1, -1, -1):\n    if abs(nums[i]) > abs(nums[j]):\n        out[w] = nums[i] ** 2; i += 1\n    else:\n        out[w] = nums[j] ** 2; j -= 1\nreturn out",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "sortedSquares",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int[]",
    },
    tests: [
      { input: [[-4, -1, 0, 3, 10]], expected: [0, 1, 9, 16, 100], sample: true },
      { input: [[-7, -3, 2, 3, 11]], expected: [4, 9, 9, 49, 121], sample: true },
      { input: [[5]], expected: [25], label: "single element" },
      { input: [[-5, -3, -1]], expected: [1, 9, 25], label: "all negative" },
      { input: [[1, 2, 3]], expected: [1, 4, 9], label: "all positive" },
      { input: [[-2, -2, 2, 2]], expected: [4, 4, 4, 4], label: "mirrored duplicates" },
      { input: [[0, 0]], expected: [0, 0], label: "zeros" },
      { input: [[-10000, 10000]], expected: [100000000, 100000000], label: "extreme values" },
      { input: [bigSorted], expected: squared(bigSorted), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Google", "Uber"],
    source: { name: "LeetCode 977. Squares of a Sorted Array", url: "https://leetcode.com/problems/squares-of-a-sorted-array/" },
    reference: `function sortedSquares(nums) {
  const out = new Array(nums.length);
  let i = 0, j = nums.length - 1;
  for (let w = nums.length - 1; w >= 0; w--) {
    if (Math.abs(nums[i]) > Math.abs(nums[j])) {
      out[w] = nums[i] * nums[i];
      i++;
    } else {
      out[w] = nums[j] * nums[j];
      j--;
    }
  }
  return out;
}`,
  },
  {
    slug: "sorted-pair-lookup",
    title: "Sorted Pair Lookup",
    pattern: "two-pointers",
    difficulty: "medium",
    rating: 1200,
    statement: `You are given an array \`numbers\` sorted in non-decreasing order and an integer \`target\`. Exactly one pair of different positions holds values that add up to \`target\`.

Return the two positions as \`[i, j]\` with \`i < j\`, counting positions **from 1**. Use only O(1) extra space.`,
    constraints: [
      "2 <= numbers.length <= 3 * 10^4",
      "-1000 <= numbers[i] <= 1000 (larger in the big test)",
      "numbers is sorted in non-decreasing order.",
      "Exactly one valid answer exists.",
    ],
    hints: [
      "The array is sorted. If the sum of the smallest and largest values is too big, which of the two can never be part of the answer?",
      "Start with pointers at both ends. If the sum is too small, move the left pointer right; if too big, move the right pointer left; if equal, you are done.",
      "i, j = 0, len(numbers) - 1\nwhile i < j:\n    s = numbers[i] + numbers[j]\n    if s == target: return [i + 1, j + 1]\n    if s < target: i += 1\n    else: j -= 1",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "twoSumSorted",
      params: [
        { name: "numbers", type: "int[]" },
        { name: "target", type: "int" },
      ],
      returns: "int[]",
    },
    tests: [
      { input: [[2, 7, 11, 15], 9], expected: [1, 2], sample: true },
      { input: [[2, 3, 4], 6], expected: [1, 3], sample: true },
      { input: [[-1, 0], -1], expected: [1, 2], label: "two elements" },
      { input: [[1, 3, 3, 8], 6], expected: [2, 3], label: "duplicates" },
      { input: [[-5, -3, -1, 4], -8], expected: [1, 2], label: "negatives" },
      { input: [[0, 0, 3, 4], 0], expected: [1, 2], label: "zeros" },
      { input: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 20], 29], expected: [9, 10], label: "pair at the end" },
      { input: [[-1000, 1, 2, 1000], 0], expected: [1, 4], label: "extreme values" },
      { input: [evensWithOdd, 3501], expected: brutePairIndices(evensWithOdd, 3501), label: "large input" },
    ],
    companies: ["Amazon", "Meta", "Google", "Apple"],
    source: {
      name: "LeetCode 167. Two Sum II - Input Array Is Sorted",
      url: "https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/",
    },
    reference: `function twoSumSorted(numbers, target) {
  let i = 0, j = numbers.length - 1;
  while (i < j) {
    const s = numbers[i] + numbers[j];
    if (s === target) return [i + 1, j + 1];
    if (s < target) i++;
    else j--;
  }
  return [];
}`,
  },
  {
    slug: "three-flag-sort",
    title: "Three-Flag Sort",
    pattern: "two-pointers",
    difficulty: "medium",
    rating: 1250,
    statement: `An array \`nums\` holds only the values \`0\`, \`1\` and \`2\`, standing for three flag colors. Rearrange it in place so all \`0\`s come first, then all \`1\`s, then all \`2\`s.

Do not call a library sort. Aim for a single pass with O(1) extra space. The function returns nothing; the tests read \`nums\` afterwards.`,
    constraints: ["1 <= nums.length <= 300 (larger in the big test)", "nums[i] is 0, 1 or 2."],
    hints: [
      "Counting each value and rewriting the array takes two passes. Can you place values into their final region as you meet them?",
      "Keep three pointers: low (next slot for a 0), mid (current), high (next slot for a 2, from the back). A 0 swaps to low, a 2 swaps to high (do not advance mid, the swapped-in value is unchecked), a 1 just advances mid.",
      "lo, mid, hi = 0, 0, len(nums) - 1\nwhile mid <= hi:\n    if nums[mid] == 0:\n        nums[lo], nums[mid] = nums[mid], nums[lo]; lo += 1; mid += 1\n    elif nums[mid] == 2:\n        nums[mid], nums[hi] = nums[hi], nums[mid]; hi -= 1\n    else:\n        mid += 1",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "sortColors",
      params: [{ name: "nums", type: "int[]" }],
      returns: "void",
      inPlaceArg: 0,
    },
    tests: [
      { input: [[2, 0, 2, 1, 1, 0]], expected: [0, 0, 1, 1, 2, 2], sample: true },
      { input: [[2, 0, 1]], expected: [0, 1, 2], sample: true },
      { input: [[1]], expected: [1], label: "single element" },
      { input: [[2, 2, 2]], expected: [2, 2, 2], label: "all twos" },
      { input: [[0, 1, 2]], expected: [0, 1, 2], label: "already sorted" },
      { input: [[2, 1, 0]], expected: [0, 1, 2], label: "reversed" },
      { input: [[1, 0, 1, 0]], expected: [0, 0, 1, 1], label: "no twos" },
      { input: [[2, 0, 2, 0]], expected: [0, 0, 2, 2], label: "no ones" },
      { input: [bigColors], expected: [...bigColors].sort((a, b) => a - b), label: "large input" },
    ],
    companies: ["Microsoft", "Amazon", "Meta", "Adobe"],
    source: { name: "LeetCode 75. Sort Colors", url: "https://leetcode.com/problems/sort-colors/" },
    reference: `function sortColors(nums) {
  let lo = 0, mid = 0, hi = nums.length - 1;
  while (mid <= hi) {
    if (nums[mid] === 0) {
      [nums[lo], nums[mid]] = [nums[mid], nums[lo]];
      lo++;
      mid++;
    } else if (nums[mid] === 2) {
      [nums[mid], nums[hi]] = [nums[hi], nums[mid]];
      hi--;
    } else {
      mid++;
    }
  }
}`,
  },
  {
    slug: "zero-sum-trios",
    title: "Zero-Sum Trios",
    pattern: "two-pointers",
    difficulty: "medium",
    rating: 1450,
    statement: `Given an integer array \`nums\`, find every distinct trio of values \`[a, b, c]\` taken from three different positions such that \`a + b + c == 0\`.

Two trios are the same if they hold the same values, whatever their positions. Return all distinct trios; the order of the trios and of the values inside each trio does not matter.`,
    constraints: ["3 <= nums.length <= 3000", "-10^5 <= nums[i] <= 10^5"],
    hints: [
      "Fix the first value of the trio. What problem is left for the other two, and does sorting help?",
      "Sort the array. For each index i, run a two-pointer search on the part to its right for a pair summing to -nums[i]. Skip equal neighbors (both for i and after a match) to avoid duplicate trios.",
      "nums.sort(); res = []\nfor i in range(len(nums) - 2):\n    if i > 0 and nums[i] == nums[i - 1]: continue\n    lo, hi = i + 1, len(nums) - 1\n    while lo < hi:\n        s = nums[i] + nums[lo] + nums[hi]\n        if s < 0: lo += 1\n        elif s > 0: hi -= 1\n        else:\n            res.append([nums[i], nums[lo], nums[hi]])\n            lo += 1\n            while lo < hi and nums[lo] == nums[lo - 1]: lo += 1\nreturn res",
    ],
    complexity: { time: "O(n^2)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "threeSum",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int[][]",
      compare: "unordered-nested",
    },
    tests: [
      { input: [[-1, 0, 1, 2, -1, -4]], expected: [[-1, -1, 2], [-1, 0, 1]], sample: true },
      { input: [[0, 1, 1]], expected: [], sample: true },
      { input: [[0, 0, 0]], expected: [[0, 0, 0]], label: "all zeros" },
      { input: [[0, 0, 0, 0, 0]], expected: [[0, 0, 0]], label: "many zeros, one trio" },
      { input: [[1, 2, 3, 4]], expected: [], label: "all positive" },
      { input: [[-2, 0, 1, 1, 2]], expected: [[-2, 0, 2], [-2, 1, 1]], label: "duplicates" },
      { input: [[3, -2, 1, 0]], expected: [], label: "no trio" },
      { input: [[-4, -2, -2, -2, 0, 1, 2, 2, 2, 3, 3, 4, 4, 6, 6]], expected: bruteThreeSum([-4, -2, -2, -2, 0, 1, 2, 2, 2, 3, 3, 4, 4, 6, 6]), label: "heavy duplicates" },
      { input: [bigTriples], expected: bruteThreeSum(bigTriples), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Google", "Microsoft", "Bloomberg", "Apple"],
    source: { name: "LeetCode 15. 3Sum", url: "https://leetcode.com/problems/3sum/" },
    reference: `function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const res = [];
  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue;
    let lo = i + 1, hi = nums.length - 1;
    while (lo < hi) {
      const s = nums[i] + nums[lo] + nums[hi];
      if (s < 0) lo++;
      else if (s > 0) hi--;
      else {
        res.push([nums[i], nums[lo], nums[hi]]);
        lo++;
        while (lo < hi && nums[lo] === nums[lo - 1]) lo++;
      }
    }
  }
  return res;
}`,
  },
];
