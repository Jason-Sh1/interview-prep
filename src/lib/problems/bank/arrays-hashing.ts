import type { Problem } from "../types";

// A deterministic permutation of 0..n-1 (7919 is prime and coprime with 2000).
const shuffledRange = (n: number) => Array.from({ length: n }, (_, i) => (i * 7919) % n);

export const arraysHashing: Problem[] = [
  {
    slug: "pair-with-target-sum",
    title: "Pair With Target Sum",
    pattern: "arrays-hashing",
    difficulty: "easy",
    rating: 950,
    statement: `Given an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers that add up to \`target\`.

Exactly one valid pair exists, and you may not use the same element twice. Return the two indices in increasing order.`,
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i], target <= 10^9",
      "Exactly one valid answer exists.",
    ],
    hints: [
      "For each number, what other value would you need to have seen already?",
      "Keep a hash map from value to index as you scan. Before storing a number, check whether target - number is already in the map.",
      "seen = {}\nfor i, x in enumerate(nums):\n    if target - x in seen: return [seen[target - x], i]\n    seen[x] = i",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "twoSum",
      params: [
        { name: "nums", type: "int[]" },
        { name: "target", type: "int" },
      ],
      returns: "int[]",
    },
    tests: [
      { input: [[2, 7, 11, 15], 9], expected: [0, 1], sample: true },
      { input: [[3, 2, 4], 6], expected: [1, 2], sample: true },
      { input: [[3, 3], 6], expected: [0, 1], label: "duplicates" },
      { input: [[-1, -2, -3, -4, -5], -8], expected: [2, 4], label: "negatives" },
      { input: [[0, 4, 3, 0], 0], expected: [0, 3], label: "zeros" },
      { input: [[1000000000, 5, -1000000000], 0], expected: [0, 2], label: "large values" },
    ],
    companies: ["Google", "Amazon", "Meta", "Microsoft", "Apple"],
    source: { name: "LeetCode 1. Two Sum", url: "https://leetcode.com/problems/two-sum/" },
    reference: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}`,
  },
  {
    slug: "bucket-the-anagrams",
    title: "Bucket the Anagrams",
    pattern: "arrays-hashing",
    difficulty: "medium",
    rating: 1250,
    statement: `You are given a list of lowercase words \`strs\`. Two words belong together when one can be turned into the other by rearranging its letters (they use exactly the same letters, the same number of times).

Split the words into groups so that every group contains exactly the words that belong together. Return the list of groups. The groups, and the words inside each group, may be returned in any order. Repeated words stay in the output as many times as they appear.`,
    constraints: [
      "0 <= strs.length <= 10^4",
      "0 <= strs[i].length <= 100",
      "strs[i] contains only lowercase English letters.",
    ],
    hints: [
      "What could you compute from a word that is identical for every rearrangement of it?",
      "Use a canonical key per word, such as its sorted letters or a 26-length letter count, and collect words in a hash map from key to list.",
      "groups = defaultdict(list)\nfor w in strs:\n    groups[''.join(sorted(w))].append(w)\nreturn list(groups.values())",
    ],
    complexity: { time: "O(n * k log k)", space: "O(n * k)" },
    signature: {
      kind: "function",
      name: "groupAnagrams",
      params: [{ name: "strs", type: "string[]" }],
      returns: "string[][]",
      compare: "unordered-nested",
    },
    tests: [
      {
        input: [["eat", "tea", "tan", "ate", "nat", "bat"]],
        expected: [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]],
        sample: true,
      },
      { input: [["listen", "silent", "google"]], expected: [["listen", "silent"], ["google"]], sample: true },
      { input: [[]], expected: [], label: "empty input" },
      { input: [[""]], expected: [[""]], label: "empty word" },
      { input: [["a"]], expected: [["a"]], label: "single word" },
      { input: [["abc", "bca", "cab", "abc"]], expected: [["abc", "bca", "cab", "abc"]], label: "duplicates" },
      {
        input: [["aab", "abb", "bba", "baa"]],
        expected: [["aab", "baa"], ["abb", "bba"]],
        label: "same letters, different counts",
      },
      { input: [["", "", "b", ""]], expected: [["", "", ""], ["b"]], label: "several empty words" },
    ],
    companies: ["Amazon", "Meta", "Google", "Bloomberg", "Uber"],
    source: { name: "LeetCode 49. Group Anagrams", url: "https://leetcode.com/problems/group-anagrams/" },
    reference: `function groupAnagrams(strs) {
  const groups = new Map();
  for (const w of strs) {
    const counts = new Array(26).fill(0);
    for (let i = 0; i < w.length; i++) counts[w.charCodeAt(i) - 97]++;
    const key = counts.join(",");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }
  return Array.from(groups.values());
}`,
  },
  {
    slug: "products-of-the-others",
    title: "Products of the Others",
    pattern: "arrays-hashing",
    difficulty: "medium",
    rating: 1350,
    statement: `Given an integer array \`nums\`, build an array \`answer\` of the same length where \`answer[i]\` is the product of every element of \`nums\` **except** \`nums[i]\`.

Do it in O(n) time and without using division. Every product is guaranteed to fit in a 32-bit signed integer.

*Follow-up:* can you use only O(1) extra space besides the output array?`,
    constraints: [
      "2 <= nums.length <= 10^5",
      "-30 <= nums[i] <= 30",
      "Every prefix and suffix product fits in a 32-bit integer.",
    ],
    hints: [
      "The product of everything except index i splits into two parts: what lies to its left and what lies to its right.",
      "Fill the output with prefix products in one left-to-right pass, then sweep right-to-left multiplying in a running suffix product.",
      "ans = [1] * n\nfor i in range(1, n): ans[i] = ans[i-1] * nums[i-1]\nsuffix = 1\nfor i in reversed(range(n)):\n    ans[i] *= suffix\n    suffix *= nums[i]",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "productExceptSelf",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int[]",
    },
    tests: [
      { input: [[1, 2, 3, 4]], expected: [24, 12, 8, 6], sample: true },
      { input: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0], sample: true },
      { input: [[2, 3]], expected: [3, 2], label: "two elements" },
      { input: [[0, 0]], expected: [0, 0], label: "two zeros" },
      { input: [[0, 4, 5]], expected: [20, 0, 0], label: "one zero" },
      { input: [[-2, -3, -4]], expected: [12, 8, 6], label: "negatives" },
      { input: [[1, 1, 1, 1, 1]], expected: [1, 1, 1, 1, 1], label: "all same" },
      {
        input: [Array.from({ length: 1000 }, (_, i) => (i % 3 === 0 ? -1 : 1))],
        // 334 entries are -1, so the full product is +1 and each answer is 1 / nums[i] = nums[i].
        expected: Array.from({ length: 1000 }, (_, i) => (i % 3 === 0 ? -1 : 1)),
        label: "large input",
      },
    ],
    companies: ["Amazon", "Meta", "Microsoft", "Apple", "Asana"],
    source: {
      name: "LeetCode 238. Product of Array Except Self",
      url: "https://leetcode.com/problems/product-of-array-except-self/",
    },
    reference: `function productExceptSelf(nums) {
  const n = nums.length;
  const ans = new Array(n).fill(1);
  for (let i = 1; i < n; i++) ans[i] = ans[i - 1] * nums[i - 1];
  let suffix = 1;
  for (let i = n - 1; i >= 0; i--) {
    ans[i] = ans[i] * suffix;
    suffix *= nums[i];
  }
  return ans;
}`,
  },
  {
    slug: "longest-unbroken-run",
    title: "Longest Unbroken Run",
    pattern: "arrays-hashing",
    difficulty: "medium",
    rating: 1500,
    statement: `You are given an unsorted array of integers \`nums\`. A *run* is a set of values \`x, x + 1, x + 2, ..., x + k\` that all appear somewhere in \`nums\` (positions do not matter).

Return the length of the longest run. Duplicate values count only once. Aim for O(n) time, so sorting is not the intended solution.`,
    constraints: ["0 <= nums.length <= 10^5", "-10^9 <= nums[i] <= 10^9"],
    hints: [
      "Put every value in a set. Which values could be the *first* element of a run?",
      "A value x starts a run only if x - 1 is not in the set. From each such start, count upward while x + 1, x + 2, ... are present. Each value is visited a constant number of times.",
      "s = set(nums); best = 0\nfor x in s:\n    if x - 1 not in s:\n        y = x\n        while y + 1 in s: y += 1\n        best = max(best, y - x + 1)\nreturn best",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "longestConsecutive",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[100, 4, 200, 1, 3, 2]], expected: 4, sample: true },
      { input: [[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]], expected: 9, sample: true },
      { input: [[]], expected: 0, label: "empty input" },
      { input: [[5]], expected: 1, label: "single element" },
      { input: [[1, 2, 0, 1]], expected: 3, label: "duplicates" },
      { input: [[-3, -1, -2, 5]], expected: 3, label: "negatives" },
      { input: [[10, 30, 20]], expected: 1, label: "no neighbors" },
      { input: [[7, 7, 7, 7]], expected: 1, label: "all same" },
      { input: [shuffledRange(2000)], expected: 2000, label: "large shuffled range" },
    ],
    companies: ["Google", "Amazon", "Meta", "Microsoft"],
    source: {
      name: "LeetCode 128. Longest Consecutive Sequence",
      url: "https://leetcode.com/problems/longest-consecutive-sequence/",
    },
    reference: `function longestConsecutive(nums) {
  const s = new Set(nums);
  let best = 0;
  for (const x of s) {
    if (s.has(x - 1)) continue;
    let y = x;
    while (s.has(y + 1)) y++;
    best = Math.max(best, y - x + 1);
  }
  return best;
}`,
  },
];
