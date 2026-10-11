import type { Problem } from "../types";

const bigPrices = Array.from({ length: 3000 }, (_, i) => ((i * 7919) % 1009) + 1);

function bruteProfit(p: number[]): number {
  let best = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) best = Math.max(best, p[j] - p[i]);
  return best;
}

// A long string over a small alphabet with an irregular pattern.
const bigText = Array.from({ length: 2000 }, (_, i) => "abcdefghijklmnop"[(i * i + 3 * i) % 16]).join("");

function bruteLongestUnique(s: string): number {
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    const seen = new Set<string>();
    let j = i;
    while (j < s.length && !seen.has(s[j])) seen.add(s[j++]);
    best = Math.max(best, j - i);
  }
  return best;
}

export const slidingWindow: Problem[] = [
  {
    slug: "single-trade-profit",
    title: "Single Trade Profit",
    pattern: "sliding-window",
    difficulty: "easy",
    rating: 1000,
    statement: `You track the price of one stock: \`prices[i]\` is its price on day \`i\`. You may buy one share on some day and sell it on a **later** day.

Return the largest profit you can make from this single trade. If no trade makes money, return \`0\`.`,
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    hints: [
      "If you sell on day j, which buying day is best?",
      "Scan once, keeping the cheapest price seen so far. At each day, the best sale today is price - cheapest; track the maximum of that.",
      "low, best = inf, 0\nfor p in prices:\n    low = min(low, p)\n    best = max(best, p - low)\nreturn best",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "maxProfit",
      params: [{ name: "prices", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[7, 1, 5, 3, 6, 4]], expected: 5, sample: true },
      { input: [[7, 6, 4, 3, 1]], expected: 0, sample: true },
      { input: [[5]], expected: 0, label: "single day" },
      { input: [[2, 4, 1]], expected: 2, label: "minimum after best sale" },
      { input: [[3, 3, 3]], expected: 0, label: "all same" },
      { input: [[2, 1, 2, 1, 0, 1, 2]], expected: 2, label: "repeated dips" },
      { input: [[1, 2, 4, 2, 5, 7, 2, 4, 9, 0]], expected: 8, label: "late peak" },
      { input: [bigPrices], expected: bruteProfit(bigPrices), label: "large input" },
    ],
    companies: ["Amazon", "Meta", "Microsoft", "Bloomberg", "Goldman Sachs"],
    source: {
      name: "LeetCode 121. Best Time to Buy and Sell Stock",
      url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/",
    },
    reference: `function maxProfit(prices) {
  let low = Infinity, best = 0;
  for (const p of prices) {
    if (p < low) low = p;
    else if (p - low > best) best = p - low;
  }
  return best;
}`,
  },
  {
    slug: "longest-distinct-stretch",
    title: "Longest Distinct Stretch",
    pattern: "sliding-window",
    difficulty: "medium",
    rating: 1300,
    statement: `Given a string \`s\`, find the longest contiguous piece of it in which no character appears twice, and return that piece's length.`,
    constraints: [
      "0 <= s.length <= 5 * 10^4",
      "s consists of English letters, digits, symbols and spaces.",
    ],
    hints: [
      "Think of a window [left, right] that always contains distinct characters. What happens when the next character is already inside it?",
      "Remember the last index of each character. When s[right] was last seen at or after left, jump left to just past that index. The window length right - left + 1 is a candidate answer.",
      "last, left, best = {}, 0, 0\nfor right, c in enumerate(s):\n    if c in last and last[c] >= left: left = last[c] + 1\n    last[c] = right\n    best = max(best, right - left + 1)\nreturn best",
    ],
    complexity: { time: "O(n)", space: "O(k)" },
    signature: {
      kind: "function",
      name: "lengthOfLongestSubstring",
      params: [{ name: "s", type: "string" }],
      returns: "int",
    },
    tests: [
      { input: ["abcabcbb"], expected: 3, sample: true },
      { input: ["pwwkew"], expected: 3, sample: true },
      { input: [""], expected: 0, label: "empty string" },
      { input: [" "], expected: 1, label: "single space" },
      { input: ["bbbbb"], expected: 1, label: "all same" },
      { input: ["dvdf"], expected: 3, label: "restart mid-window" },
      { input: ["abba"], expected: 2, label: "stale index" },
      { input: ["a1!A b"], expected: 6, label: "mixed characters" },
      { input: [bigText], expected: bruteLongestUnique(bigText), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Meta", "Microsoft", "Bloomberg"],
    source: {
      name: "LeetCode 3. Longest Substring Without Repeating Characters",
      url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
    },
    reference: `function lengthOfLongestSubstring(s) {
  const last = new Map();
  let left = 0, best = 0;
  for (let right = 0; right < s.length; right++) {
    const c = s[right];
    if (last.has(c) && last.get(c) >= left) left = last.get(c) + 1;
    last.set(c, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}`,
  },
  {
    slug: "shortest-covering-window",
    title: "Shortest Covering Window",
    pattern: "sliding-window",
    difficulty: "hard",
    rating: 1750,
    statement: `You are given two strings \`s\` and \`t\`. A contiguous piece of \`s\` *covers* \`t\` if it contains every character of \`t\` at least as many times as it appears in \`t\` (letters are case-sensitive).

Return the shortest piece of \`s\` that covers \`t\`. If several shortest pieces exist, return the one that starts earliest. If no piece covers \`t\`, return the empty string.`,
    constraints: [
      "1 <= s.length, t.length <= 10^5",
      "s and t consist of uppercase and lowercase English letters.",
    ],
    hints: [
      "Grow a window to the right until it covers t, then try to shrink it from the left as far as possible while it still covers t.",
      "Count what t needs. Track how many distinct characters are currently satisfied. Each time the window is valid, record it if strictly shorter, then drop s[left] and advance left.",
      "need = Counter(t); have = 0; left = 0; best = None\nfor right, c in enumerate(s):\n    window[c] += 1\n    if window[c] == need[c]: have += 1\n    while have == len(need):\n        record s[left:right+1] if shorter\n        window[s[left]] -= 1\n        if s[left] in need and window[s[left]] < need[s[left]]: have -= 1\n        left += 1",
    ],
    complexity: { time: "O(m + n)", space: "O(k)" },
    signature: {
      kind: "function",
      name: "minWindow",
      params: [
        { name: "s", type: "string" },
        { name: "t", type: "string" },
      ],
      returns: "string",
    },
    tests: [
      { input: ["ADOBECODEBANC", "ABC"], expected: "BANC", sample: true },
      { input: ["a", "aa"], expected: "", sample: true },
      { input: ["a", "a"], expected: "a", label: "single character" },
      { input: ["ab", "b"], expected: "b", label: "at the end" },
      { input: ["aaflslflsldkalskaaa", "aaa"], expected: "aaa", label: "repeated needs" },
      { input: ["abcab", "ab"], expected: "ab", label: "tie goes to earliest" },
      { input: ["bba", "ab"], expected: "ba", label: "extra copies before" },
      { input: ["cabwefgewcwaefgcf", "cae"], expected: "cwae", label: "best window in the middle" },
      { input: ["aA", "AA"], expected: "", label: "case-sensitive" },
      {
        input: ["x".repeat(3000) + "yz" + "x".repeat(3000), "zy"],
        expected: "yz",
        label: "large input",
      },
    ],
    companies: ["Meta", "Amazon", "Google", "LinkedIn", "Airbnb"],
    source: {
      name: "LeetCode 76. Minimum Window Substring",
      url: "https://leetcode.com/problems/minimum-window-substring/",
    },
    reference: `function minWindow(s, t) {
  const need = new Map();
  for (const c of t) need.set(c, (need.get(c) || 0) + 1);
  const window = new Map();
  let have = 0, left = 0, bestStart = 0, bestLen = Infinity;
  for (let right = 0; right < s.length; right++) {
    const c = s[right];
    window.set(c, (window.get(c) || 0) + 1);
    if (need.has(c) && window.get(c) === need.get(c)) have++;
    while (have === need.size) {
      if (right - left + 1 < bestLen) {
        bestLen = right - left + 1;
        bestStart = left;
      }
      const d = s[left];
      window.set(d, window.get(d) - 1);
      if (need.has(d) && window.get(d) < need.get(d)) have--;
      left++;
    }
  }
  return bestLen === Infinity ? "" : s.slice(bestStart, bestStart + bestLen);
}`,
  },
];
