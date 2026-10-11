import type { Problem } from "../types";

export const dp1d: Problem[] = [
  {
    slug: "staircase-hops",
    title: "Staircase Hops",
    pattern: "dp-1d",
    difficulty: "easy",
    rating: 950,
    statement: `You are at the bottom of a staircase with \`n\` steps. With each move you climb either **1** or **2** steps.

Return the number of different sequences of moves that take you exactly to the top step.`,
    constraints: ["1 <= n <= 45"],
    hints: [
      "Your last move onto step n came from either step n - 1 or step n - 2.",
      "ways(n) = ways(n - 1) + ways(n - 2), with ways(1) = 1 and ways(2) = 2. You only need the last two values, not a whole table.",
      "a, b = 1, 1  # ways to reach step 0 and step 1\nfor _ in range(n - 1):\n    a, b = b, a + b\nreturn b",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "climbStairs",
      params: [{ name: "n", type: "int" }],
      returns: "int",
    },
    tests: [
      { input: [2], expected: 2, sample: true },
      { input: [3], expected: 3, sample: true },
      { input: [1], expected: 1, label: "single step" },
      { input: [4], expected: 5 },
      { input: [5], expected: 8 },
      { input: [10], expected: 89 },
      { input: [30], expected: 1346269, label: "medium n" },
      { input: [45], expected: 1836311903, label: "maximum n" },
    ],
    companies: ["Amazon", "Google", "Adobe", "Apple"],
    source: { name: "LeetCode 70. Climbing Stairs", url: "https://leetcode.com/problems/climbing-stairs/" },
    reference: `function climbStairs(n) {
  let a = 1, b = 1;
  for (let i = 1; i < n; i++) { const c = a + b; a = b; b = c; }
  return b;
}`,
  },
  {
    slug: "fewest-coins-for-change",
    title: "Fewest Coins for Change",
    pattern: "dp-1d",
    difficulty: "medium",
    rating: 1350,
    statement: `You have an unlimited supply of coins of each value in \`coins\`. Return the smallest number of coins whose values add up to exactly \`amount\`.

If no combination of coins makes \`amount\`, return \`-1\`. Making an amount of \`0\` takes \`0\` coins.`,
    constraints: ["1 <= coins.length <= 12", "1 <= coins[i] <= 2^31 - 1", "0 <= amount <= 10^4"],
    hints: [
      "Picking the largest coin first does not always work: try coins [1, 3, 4] and amount 6.",
      "Let best[a] be the fewest coins that make amount a. Then best[a] = 1 + min(best[a - c]) over coins c <= a. Fill it from 0 upward.",
      "best = [0] + [inf] * amount\nfor a in range(1, amount + 1):\n    for c in coins:\n        if c <= a: best[a] = min(best[a], best[a - c] + 1)\nreturn best[amount] if best[amount] != inf else -1",
    ],
    complexity: { time: "O(amount · k)", space: "O(amount)" },
    signature: {
      kind: "function",
      name: "coinChange",
      params: [
        { name: "coins", type: "int[]" },
        { name: "amount", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: [[1, 3, 4], 6], expected: 2, sample: true },
      { input: [[2], 3], expected: -1, sample: true },
      { input: [[1], 0], expected: 0, label: "amount zero" },
      { input: [[5], 5], expected: 1, label: "single coin" },
      { input: [[3, 7], 1], expected: -1, label: "amount below every coin" },
      { input: [[2, 5, 10, 1], 27], expected: 4, label: "unsorted coins" },
      { input: [[186, 419, 83, 408], 6249], expected: 20, label: "greedy fails" },
      { input: [[2147483647], 2], expected: -1, label: "huge coin" },
      { input: [[1, 2, 5], 10000], expected: 2000, label: "large amount" },
    ],
    companies: ["Amazon", "Google", "Microsoft", "Bloomberg", "Goldman Sachs"],
    source: { name: "LeetCode 322. Coin Change", url: "https://leetcode.com/problems/coin-change/" },
    reference: `function coinChange(coins, amount) {
  const best = new Array(amount + 1).fill(Infinity);
  best[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const c of coins) {
      if (c <= a && best[a - c] + 1 < best[a]) best[a] = best[a - c] + 1;
    }
  }
  return best[amount] === Infinity ? -1 : best[amount];
}`,
  },
  {
    slug: "split-into-dictionary-words",
    title: "Split Into Dictionary Words",
    pattern: "dp-1d",
    difficulty: "medium",
    rating: 1480,
    statement: `Given a string \`s\` and a list of words \`wordDict\`, return \`true\` if \`s\` can be cut into a sequence of one or more pieces where every piece is a word from \`wordDict\`.

Words may be used any number of times, and not every word needs to be used.`,
    constraints: [
      "1 <= s.length <= 300",
      "1 <= wordDict.length <= 1000",
      "1 <= wordDict[i].length <= 20",
      "s and the words contain only lowercase English letters.",
      "The words in wordDict are distinct.",
    ],
    hints: [
      "A greedy split (always take the longest or shortest matching word) can paint you into a corner. Track every reachable cut point instead.",
      "Let ok[i] mean the prefix s[:i] can be split. ok[0] is true, and ok[i] is true if some j < i has ok[j] and s[j:i] in the dictionary. Only check j within the longest word length of i.",
      "words = set(wordDict); L = max(map(len, words))\nok = [True] + [False] * len(s)\nfor i in range(1, len(s) + 1):\n    for j in range(max(0, i - L), i):\n        if ok[j] and s[j:i] in words: ok[i] = True; break\nreturn ok[len(s)]",
    ],
    complexity: { time: "O(n · L²)", space: "O(n + total dictionary size)" },
    signature: {
      kind: "function",
      name: "wordBreak",
      params: [
        { name: "s", type: "string" },
        { name: "wordDict", type: "string[]" },
      ],
      returns: "bool",
    },
    tests: [
      { input: ["sunflower", ["sun", "flow", "flower"]], expected: true, sample: true },
      { input: ["sunflow", ["sun", "flower"]], expected: false, sample: true },
      { input: ["a", ["b"]], expected: false, label: "single character, no match" },
      { input: ["aaaa", ["a"]], expected: true, label: "reuse one word" },
      { input: ["cars", ["car", "ca", "rs"]], expected: true, label: "greedy longest fails" },
      { input: ["abcd", ["a", "abc", "b", "cd"]], expected: true, label: "several split points" },
      { input: ["catsandog", ["cats", "dog", "sand", "and", "cat"]], expected: false, label: "almost splittable" },
      { input: ["go", ["go", "g", "o"]], expected: true, label: "whole string is a word" },
      { input: ["a".repeat(150) + "b", ["a", "aa", "aaa", "aaaa"]], expected: false, label: "many dead ends" },
    ],
    companies: ["Amazon", "Google", "Meta", "Bloomberg", "Uber"],
    source: { name: "LeetCode 139. Word Break", url: "https://leetcode.com/problems/word-break/" },
    reference: `function wordBreak(s, wordDict) {
  const words = new Set(wordDict);
  let maxLen = 0;
  for (const w of wordDict) maxLen = Math.max(maxLen, w.length);
  const ok = new Array(s.length + 1).fill(false);
  ok[0] = true;
  for (let i = 1; i <= s.length; i++) {
    for (let j = Math.max(0, i - maxLen); j < i; j++) {
      if (ok[j] && words.has(s.slice(j, i))) { ok[i] = true; break; }
    }
  }
  return ok[s.length];
}`,
  },
];
