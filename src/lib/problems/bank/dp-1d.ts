import type { Problem } from "../types";

// Brute-force helpers (top-down or quadratic) for expected values.
function climbCostTopDown(cost: number[]): number {
  const memo = new Map<number, number>();
  const from = (i: number): number => {
    if (i >= cost.length) return 0;
    if (!memo.has(i)) memo.set(i, cost[i] + Math.min(from(i + 1), from(i + 2)));
    return memo.get(i)!;
  };
  return Math.min(from(0), from(1));
}

function heistQuadratic(nums: number[]): number {
  if (nums.length === 0) return 0;
  const take = nums.map(() => 0);
  for (let i = 0; i < nums.length; i++) {
    let prev = 0;
    for (let j = 0; j < i - 1; j++) prev = Math.max(prev, take[j]);
    take[i] = nums[i] + prev;
  }
  return Math.max(...take);
}
const circularHeistBrute = (nums: number[]) =>
  nums.length === 1 ? nums[0] : Math.max(heistQuadratic(nums.slice(1)), heistQuadratic(nums.slice(0, -1)));

function decodingsTopDown(s: string): number {
  const memo = new Map<number, number>();
  const from = (i: number): number => {
    if (i === s.length) return 1;
    if (s[i] === "0") return 0;
    if (memo.has(i)) return memo.get(i)!;
    let ways = from(i + 1);
    if (i + 1 < s.length && Number(s.slice(i, i + 2)) <= 26) ways += from(i + 2);
    memo.set(i, ways);
    return ways;
  };
  return from(0);
}

function risingQuadratic(nums: number[]): number {
  const len = nums.map(() => 1);
  for (let i = 0; i < nums.length; i++) for (let j = 0; j < i; j++) if (nums[j] < nums[i]) len[i] = Math.max(len[i], len[j] + 1);
  return Math.max(...len);
}

const stepCosts = Array.from({ length: 1000 }, (_, i) => (i * 37 + 11) % 1000);
const houses = Array.from({ length: 1000 }, (_, i) => (i * 53 + 7) % 401);
const circleHouses = Array.from({ length: 999 }, (_, i) => (i * 29 + 3) % 1000);
const longCode = "1121926112261221112192611226122111219261122612";
const noisy = Array.from({ length: 2500 }, (_, i) => ((i * 7919 + 13) % 20001) - 10000);

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
  {
    slug: "cheapest-climb",
    title: "Cheapest Climb",
    pattern: "dp-1d",
    difficulty: "easy",
    rating: 1000,
    statement: `A staircase has steps \`0\` to \`n - 1\`, and stepping on step \`i\` costs \`cost[i]\`. You may start on step \`0\` or step \`1\` for free, and after paying for a step you climb either one or two steps.

Return the lowest total cost to get past the last step (to the top, just beyond step \`n - 1\`).`,
    constraints: ["2 <= cost.length <= 1000", "0 <= cost[i] <= 999"],
    hints: [
      "To be on step i, you came from step i - 1 or step i - 2. Which one would you rather have come from?",
      "Let best[i] be the cheapest cost to stand on step i (before paying for it): best[i] = min(best[i - 1] + cost[i - 1], best[i - 2] + cost[i - 2]), with best[0] = best[1] = 0. The answer is best[n]. Keep just two variables.",
      "a, b = 0, 0   # best[i - 2], best[i - 1]\nfor i in range(2, len(cost) + 1):\n    a, b = b, min(b + cost[i - 1], a + cost[i - 2])\nreturn b",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "minCostClimbingStairs",
      params: [{ name: "cost", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[10, 15, 20]], expected: 15, sample: true },
      { input: [[1, 100, 1, 1, 1, 100, 1, 1, 100, 1]], expected: 6, sample: true },
      { input: [[5, 3]], expected: 3, label: "two steps" },
      { input: [[0, 0, 0, 0]], expected: 0, label: "free steps" },
      { input: [[3, 3]], expected: 3, label: "equal starts" },
      { input: [[1, 999, 999, 1]], expected: 1000, label: "must pay one expensive step" },
      { input: [[999, 1, 999, 1, 999]], expected: 2, label: "skip every expensive step" },
      { input: [stepCosts], expected: climbCostTopDown(stepCosts), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Adobe", "Microsoft"],
    source: { name: "LeetCode 746. Min Cost Climbing Stairs", url: "https://leetcode.com/problems/min-cost-climbing-stairs/" },
    reference: `function minCostClimbingStairs(cost) {
  let a = 0, b = 0;
  for (let i = 2; i <= cost.length; i++) {
    const c = Math.min(b + cost[i - 1], a + cost[i - 2]);
    a = b;
    b = c;
  }
  return b;
}`,
  },
  {
    slug: "quiet-heist-on-one-street",
    title: "Quiet Heist on One Street",
    pattern: "dp-1d",
    difficulty: "medium",
    rating: 1120,
    statement: `Houses stand in a row, and house \`i\` holds \`nums[i]\` in cash. The alarm system links neighbors: robbing two adjacent houses on the same night sets it off.

Return the most cash you can take in one night without robbing two adjacent houses.`,
    constraints: ["1 <= nums.length <= 1000", "0 <= nums[i] <= 400"],
    hints: [
      "For the last house you either rob it or skip it. What does each choice leave you with?",
      "best[i] = max(best[i - 1], best[i - 2] + nums[i]): skip house i, or rob it on top of the best plan for houses up to i - 2. Two variables are enough.",
      "skip, take = 0, 0   # best up to i - 2, best up to i - 1\nfor x in nums:\n    skip, take = take, max(take, skip + x)\nreturn take",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "rob",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[1, 2, 3, 1]], expected: 4, sample: true },
      { input: [[2, 7, 9, 3, 1]], expected: 12, sample: true },
      { input: [[5]], expected: 5, label: "single house" },
      { input: [[2, 9]], expected: 9, label: "two houses" },
      { input: [[0, 0, 0]], expected: 0, label: "empty houses" },
      { input: [[2, 1, 1, 2]], expected: 4, label: "skip two in a row" },
      { input: [[4, 1, 2, 7, 5, 3, 1]], expected: 14, label: "mixed values" },
      { input: [[400, 400, 400, 400, 400]], expected: 1200, label: "all equal" },
      { input: [houses], expected: heistQuadratic(houses), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Cisco", "Microsoft", "Apple"],
    source: { name: "LeetCode 198. House Robber", url: "https://leetcode.com/problems/house-robber/" },
    reference: `function rob(nums) {
  let skip = 0, take = 0;
  for (const x of nums) {
    const next = Math.max(take, skip + x);
    skip = take;
    take = next;
  }
  return take;
}`,
  },
  {
    slug: "heist-on-a-circular-street",
    title: "Heist on a Circular Street",
    pattern: "dp-1d",
    difficulty: "medium",
    rating: 1250,
    statement: `Houses stand around a circle, so the first and last houses are neighbors. House \`i\` holds \`nums[i]\` in cash, and robbing two neighboring houses on the same night sets off the alarm.

Return the most cash you can take in one night without robbing two neighbors.`,
    constraints: ["1 <= nums.length <= 1000", "0 <= nums[i] <= 1000"],
    hints: [
      "The only new constraint compared with a straight street is between the first and last house. You can never rob both.",
      "Solve the straight-street version twice: once without the last house, once without the first. The answer is the larger result (with a single house, just return it).",
      "def line(a):\n    skip = take = 0\n    for x in a: skip, take = take, max(take, skip + x)\n    return take\nif len(nums) == 1: return nums[0]\nreturn max(line(nums[1:]), line(nums[:-1]))",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "rob",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[2, 3, 2]], expected: 3, sample: true },
      { input: [[1, 2, 3, 1]], expected: 4, sample: true },
      { input: [[7]], expected: 7, label: "single house" },
      { input: [[1, 5]], expected: 5, label: "two houses are neighbors" },
      { input: [[1, 2, 3]], expected: 3, label: "three houses" },
      { input: [[200, 3, 140, 20, 10]], expected: 340, label: "ends both tempting" },
      { input: [[0, 0, 0, 0]], expected: 0, label: "empty houses" },
      { input: [[1, 3, 1, 3, 100]], expected: 103, label: "drop the first house" },
      { input: [circleHouses], expected: circularHeistBrute(circleHouses), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Microsoft", "Bloomberg"],
    source: { name: "LeetCode 213. House Robber II", url: "https://leetcode.com/problems/house-robber-ii/" },
    reference: `function rob(nums) {
  if (nums.length === 1) return nums[0];
  const line = (lo, hi) => {
    let skip = 0, take = 0;
    for (let i = lo; i < hi; i++) {
      const next = Math.max(take, skip + nums[i]);
      skip = take;
      take = next;
    }
    return take;
  };
  return Math.max(line(1, nums.length), line(0, nums.length - 1));
}`,
  },
  {
    slug: "count-letter-code-decodings",
    title: "Count Letter-Code Decodings",
    pattern: "dp-1d",
    difficulty: "medium",
    rating: 1420,
    statement: `A message of capital letters was encoded by replacing each letter with its position in the alphabet: \`A\` → \`"1"\`, \`B\` → \`"2"\`, ..., \`Z\` → \`"26"\`, with no separators.

Given the digit string \`s\`, return how many different letter messages could have produced it. Codes never have leading zeros, so \`"06"\` cannot stand for \`F\`. If no message fits, return \`0\`. The answer fits in a 32-bit integer.`,
    constraints: ["1 <= s.length <= 100", "s contains only digits and may start with '0'."],
    hints: [
      "The last letter of the message used either the last digit or the last two digits.",
      "ways[i] counts decodings of the first i digits. Add ways[i - 1] if digit i - 1 is not '0'; add ways[i - 2] if the two digits ending at i - 1 form 10..26. Start with ways[0] = 1.",
      "prev2, prev1 = 1, 0 if s[0] == '0' else 1\nfor i in range(1, len(s)):\n    cur = 0\n    if s[i] != '0': cur += prev1\n    if 10 <= int(s[i-1:i+1]) <= 26: cur += prev2\n    prev2, prev1 = prev1, cur\nreturn prev1",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "numDecodings",
      params: [{ name: "s", type: "string" }],
      returns: "int",
    },
    tests: [
      { input: ["12"], expected: 2, sample: true },
      { input: ["226"], expected: 3, sample: true },
      { input: ["06"], expected: 0, label: "leading zero" },
      { input: ["0"], expected: 0, label: "just zero" },
      { input: ["10"], expected: 1, label: "zero must pair" },
      { input: ["100"], expected: 0, label: "double zero" },
      { input: ["27"], expected: 1, label: "over 26" },
      { input: ["11106"], expected: 2, label: "zero in the middle" },
      { input: ["2611055971756562"], expected: decodingsTopDown("2611055971756562"), label: "long mixed code" },
      { input: [longCode], expected: decodingsTopDown(longCode), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Google", "Microsoft", "Uber"],
    source: { name: "LeetCode 91. Decode Ways", url: "https://leetcode.com/problems/decode-ways/" },
    reference: `function numDecodings(s) {
  let prev2 = 1, prev1 = s[0] === "0" ? 0 : 1;
  for (let i = 1; i < s.length; i++) {
    let cur = 0;
    if (s[i] !== "0") cur += prev1;
    const two = Number(s.slice(i - 1, i + 1));
    if (two >= 10 && two <= 26) cur += prev2;
    prev2 = prev1;
    prev1 = cur;
  }
  return prev1;
}`,
  },
  {
    slug: "longest-rising-subsequence",
    title: "Longest Rising Subsequence",
    pattern: "dp-1d",
    difficulty: "medium",
    rating: 1550,
    statement: `Given an integer array \`nums\`, return the length of the longest subsequence whose values strictly increase. A subsequence keeps the original order but may skip elements.

An O(n²) solution works for the smaller tests; aim for O(n log n).`,
    constraints: ["1 <= nums.length <= 2500", "-10^4 <= nums[i] <= 10^4"],
    hints: [
      "Start with the O(n²) idea: the longest rising subsequence ending at i extends the best one ending at some earlier, smaller value.",
      "For O(n log n), keep tails[k] = the smallest possible last value of a rising subsequence of length k + 1. For each x, binary search the first tail >= x and replace it (or append x if none). The answer is len(tails).",
      "tails = []\nfor x in nums:\n    i = bisect_left(tails, x)\n    if i == len(tails): tails.append(x)\n    else: tails[i] = x\nreturn len(tails)",
    ],
    complexity: { time: "O(n log n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "lengthOfLIS",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[10, 9, 2, 5, 3, 7, 101, 18]], expected: 4, sample: true },
      { input: [[0, 1, 0, 3, 2, 3]], expected: 4, sample: true },
      { input: [[7, 7, 7, 7]], expected: 1, label: "all equal (strictly rising)" },
      { input: [[5]], expected: 1, label: "single element" },
      { input: [[5, 4, 3, 2, 1]], expected: 1, label: "decreasing" },
      { input: [[1, 2, 3, 4, 5]], expected: 5, label: "already sorted" },
      { input: [[4, 10, 4, 3, 8, 9]], expected: 3, label: "replace a tail" },
      { input: [[-10000, 10000, -9999, 0]], expected: 3, label: "extreme values" },
      { input: [noisy], expected: risingQuadratic(noisy), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Microsoft", "Meta", "TikTok"],
    source: {
      name: "LeetCode 300. Longest Increasing Subsequence",
      url: "https://leetcode.com/problems/longest-increasing-subsequence/",
    },
    reference: `function lengthOfLIS(nums) {
  const tails = [];
  for (const x of nums) {
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = x;
  }
  return tails.length;
}`,
  },
];
