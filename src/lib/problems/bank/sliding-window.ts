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

function bruteMaxAverage(nums: number[], k: number): number {
  let best = -Infinity;
  for (let i = 0; i + k <= nums.length; i++) {
    let s = 0;
    for (let j = i; j < i + k; j++) s += nums[j];
    best = Math.max(best, s / k);
  }
  return best;
}

function bruteMinLen(target: number, nums: number[]): number {
  let best = 0;
  for (let i = 0; i < nums.length; i++) {
    let s = 0;
    for (let j = i; j < nums.length; j++) {
      s += nums[j];
      if (s >= target) {
        if (!best || j - i + 1 < best) best = j - i + 1;
        break;
      }
    }
  }
  return best;
}

function bruteContainsPermutation(s1: string, s2: string): boolean {
  const key = (s: string) => s.split("").sort().join("");
  const want = key(s1);
  for (let i = 0; i + s1.length <= s2.length; i++) if (key(s2.slice(i, i + s1.length)) === want) return true;
  return false;
}

function bruteReplacement(s: string, k: number): number {
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    const count = new Map<string, number>();
    let top = 0;
    for (let j = i; j < s.length; j++) {
      const c = (count.get(s[j]) ?? 0) + 1;
      count.set(s[j], c);
      top = Math.max(top, c);
      if (j - i + 1 - top <= k) best = Math.max(best, j - i + 1);
    }
  }
  return best;
}

function bruteWindowMax(nums: number[], k: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + k <= nums.length; i++) out.push(Math.max(...nums.slice(i, i + k)));
  return out;
}

const bigReadings = Array.from({ length: 3000 }, (_, i) => ((i * 7919) % 2001) - 1000);
const bigPositives = Array.from({ length: 3000 }, (_, i) => ((i * 31 + 7) % 50) + 1);
const bigHay = Array.from({ length: 2000 }, (_, i) => "abcdef"[(i * i + i) % 6]).join("");
const bigAB = Array.from({ length: 1500 }, (_, i) => "ABC"[(i * 5 + (i >> 4)) % 3]).join("");
const bigWaves = Array.from({ length: 3000 }, (_, i) => ((i * 7919) % 10007) - 5000);

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
  {
    slug: "best-k-day-average",
    title: "Best K-Day Average",
    pattern: "sliding-window",
    difficulty: "easy",
    rating: 950,
    statement: `A sensor logged one integer reading per day in \`nums\`. Given an integer \`k\`, look at every run of exactly \`k\` consecutive days and return the highest average reading among them.

Answers within \`10^-5\` of the true value are accepted.`,
    constraints: ["1 <= k <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
    hints: [
      "Recomputing every window's sum from scratch is O(n·k). Neighboring windows share almost all their days.",
      "Compute the sum of the first k values, then slide: add the value entering on the right and subtract the one leaving on the left. Track the best sum and divide by k once at the end.",
      "s = sum(nums[:k]); best = s\nfor i in range(k, len(nums)):\n    s += nums[i] - nums[i - k]\n    best = max(best, s)\nreturn best / k",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "findMaxAverage",
      params: [
        { name: "nums", type: "int[]" },
        { name: "k", type: "int" },
      ],
      returns: "float",
      compare: "float",
    },
    tests: [
      { input: [[1, 12, -5, -6, 50, 3], 4], expected: 12.75, sample: true },
      { input: [[5], 1], expected: 5, sample: true },
      { input: [[-1, -2, -3], 1], expected: -1, label: "all negative" },
      { input: [[3, 3, 3, 3], 2], expected: 3, label: "all same" },
      { input: [[1, 2, 3, 4], 4], expected: 2.5, label: "k equals length" },
      { input: [[0, 4, 0, 3, 2], 1], expected: 4, label: "k is one" },
      { input: [[7, 4, 5, 8, 8, 3, 9, 8, 7, 6], 7], expected: 7, label: "best window at the end" },
      { input: [[-10000, 10000, -10000], 2], expected: 0, label: "extreme values" },
      { input: [bigReadings, 37], expected: bruteMaxAverage(bigReadings, 37), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Meta"],
    source: { name: "LeetCode 643. Maximum Average Subarray I", url: "https://leetcode.com/problems/maximum-average-subarray-i/" },
    reference: `function findMaxAverage(nums, k) {
  let s = 0;
  for (let i = 0; i < k; i++) s += nums[i];
  let best = s;
  for (let i = k; i < nums.length; i++) {
    s += nums[i] - nums[i - k];
    best = Math.max(best, s);
  }
  return best / k;
}`,
  },
  {
    slug: "shortest-run-reaching-target",
    title: "Shortest Run Reaching Target",
    pattern: "sliding-window",
    difficulty: "medium",
    rating: 1250,
    statement: `You are given an array of positive integers \`nums\` and a positive integer \`target\`. Find the length of the shortest contiguous run of elements whose sum is **at least** \`target\`.

Return \`0\` if no run reaches the target.`,
    constraints: ["1 <= target <= 10^9", "1 <= nums.length <= 10^5", "1 <= nums[i] <= 10^4"],
    hints: [
      "All values are positive, so extending a run only increases its sum and shrinking it only decreases the sum.",
      "Grow a window to the right, adding each value. While the window sum is at least target, record its length and shrink it from the left.",
      "lo = s = 0; best = inf\nfor hi, x in enumerate(nums):\n    s += x\n    while s >= target:\n        best = min(best, hi - lo + 1)\n        s -= nums[lo]; lo += 1\nreturn 0 if best == inf else best",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "minSubArrayLen",
      params: [
        { name: "target", type: "int" },
        { name: "nums", type: "int[]" },
      ],
      returns: "int",
    },
    tests: [
      { input: [7, [2, 3, 1, 2, 4, 3]], expected: 2, sample: true },
      { input: [11, [1, 1, 1, 1, 1, 1, 1, 1]], expected: 0, sample: true },
      { input: [4, [1, 4, 4]], expected: 1, label: "single element suffices" },
      { input: [15, [1, 2, 3, 4, 5]], expected: 5, label: "needs everything" },
      { input: [1, [5]], expected: 1, label: "single element" },
      { input: [100, [50]], expected: 0, label: "single element too small" },
      { input: [11, [1, 2, 3, 4, 5]], expected: 3, label: "best at the end" },
      { input: [6, [3, 3, 3, 3]], expected: 2, label: "all same" },
      { input: [1000, bigPositives], expected: bruteMinLen(1000, bigPositives), label: "large input" },
      { input: [1000000, bigPositives], expected: 0, label: "large, unreachable" },
    ],
    companies: ["Meta", "Amazon", "Google", "Goldman Sachs"],
    source: { name: "LeetCode 209. Minimum Size Subarray Sum", url: "https://leetcode.com/problems/minimum-size-subarray-sum/" },
    reference: `function minSubArrayLen(target, nums) {
  let lo = 0, s = 0, best = Infinity;
  for (let hi = 0; hi < nums.length; hi++) {
    s += nums[hi];
    while (s >= target) {
      best = Math.min(best, hi - lo + 1);
      s -= nums[lo++];
    }
  }
  return best === Infinity ? 0 : best;
}`,
  },
  {
    slug: "hidden-shuffle-inside",
    title: "Hidden Shuffle Inside",
    pattern: "sliding-window",
    difficulty: "medium",
    rating: 1350,
    statement: `Given two lowercase strings \`s1\` and \`s2\`, return \`true\` if some contiguous piece of \`s2\` is a reordering of \`s1\` (it uses exactly the same letters, the same number of times), and \`false\` otherwise.`,
    constraints: ["1 <= s1.length, s2.length <= 10^4", "s1 and s2 consist of lowercase English letters."],
    hints: [
      "Any matching piece of s2 has exactly the same length as s1. What changes between two neighboring pieces of that length?",
      "Keep letter counts for s1 and for a window of length len(s1) sliding over s2. Each step adds one letter and removes one. Compare the two 26-entry counts (or track how many letters currently match).",
      "if len(s1) > len(s2): return False\nneed = Counter(s1); win = Counter(s2[:len(s1)])\nif win == need: return True\nfor i in range(len(s1), len(s2)):\n    win[s2[i]] += 1\n    win[s2[i - len(s1)]] -= 1\n    if win == need: return True\nreturn False",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "checkInclusion",
      params: [
        { name: "s1", type: "string" },
        { name: "s2", type: "string" },
      ],
      returns: "bool",
    },
    tests: [
      { input: ["ab", "eidbaooo"], expected: true, sample: true },
      { input: ["ab", "eidboaoo"], expected: false, sample: true },
      { input: ["a", "a"], expected: true, label: "single letter" },
      { input: ["abc", "ab"], expected: false, label: "s1 longer than s2" },
      { input: ["adc", "dcda"], expected: true, label: "match at the end" },
      { input: ["aab", "abbba"], expected: false, label: "counts matter" },
      { input: ["hello", "ooolleoooleh"], expected: false, label: "letters present but scattered" },
      { input: ["abc", "cba"], expected: true, label: "whole string" },
      { input: [bigHay.slice(1500, 1508).split("").reverse().join(""), bigHay], expected: true, label: "large input" },
      { input: ["aabbccddeeff", bigHay], expected: bruteContainsPermutation("aabbccddeeff", bigHay), label: "large, balanced letters" },
    ],
    companies: ["Microsoft", "Amazon", "Meta", "Google"],
    source: { name: "LeetCode 567. Permutation in String", url: "https://leetcode.com/problems/permutation-in-string/" },
    reference: `function checkInclusion(s1, s2) {
  const m = s1.length;
  if (m > s2.length) return false;
  const need = new Array(26).fill(0), win = new Array(26).fill(0);
  for (let i = 0; i < m; i++) {
    need[s1.charCodeAt(i) - 97]++;
    win[s2.charCodeAt(i) - 97]++;
  }
  const same = () => need.every((c, i) => c === win[i]);
  if (same()) return true;
  for (let i = m; i < s2.length; i++) {
    win[s2.charCodeAt(i) - 97]++;
    win[s2.charCodeAt(i - m) - 97]--;
    if (same()) return true;
  }
  return false;
}`,
  },
  {
    slug: "repaint-for-longest-streak",
    title: "Repaint for the Longest Streak",
    pattern: "sliding-window",
    difficulty: "medium",
    rating: 1400,
    statement: `You are given a string \`s\` of uppercase letters and an integer \`k\`. You may repaint at most \`k\` characters, changing each to any uppercase letter you like.

Return the length of the longest stretch of identical letters you can produce.`,
    constraints: ["1 <= s.length <= 10^5", "s consists of uppercase English letters.", "0 <= k <= s.length"],
    hints: [
      "For a fixed window, how many repaints does it need to become all one letter?",
      "A window needs (length - count of its most common letter) repaints. Grow the window to the right; when it needs more than k repaints, move the left edge one step. The best-seen max count never needs to decrease for the answer to be right.",
      "count = defaultdict(int); lo = top = best = 0\nfor hi, c in enumerate(s):\n    count[c] += 1\n    top = max(top, count[c])\n    while hi - lo + 1 - top > k:\n        count[s[lo]] -= 1; lo += 1\n    best = max(best, hi - lo + 1)\nreturn best",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "characterReplacement",
      params: [
        { name: "s", type: "string" },
        { name: "k", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: ["ABAB", 2], expected: 4, sample: true },
      { input: ["AABABBA", 1], expected: 4, sample: true },
      { input: ["A", 0], expected: 1, label: "single letter" },
      { input: ["ABCD", 0], expected: 1, label: "no repaints" },
      { input: ["AAAA", 2], expected: 4, label: "already uniform" },
      { input: ["ABCDE", 5], expected: 5, label: "k covers everything" },
      { input: ["ABBB", 2], expected: 4, label: "k more than needed" },
      { input: ["BAAAB", 0], expected: 3, label: "longest existing run" },
      { input: ["ABCABCABC", 2], expected: 4, label: "three-letter cycle" },
      { input: [bigAB, 25], expected: bruteReplacement(bigAB, 25), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Meta", "Uber"],
    source: {
      name: "LeetCode 424. Longest Repeating Character Replacement",
      url: "https://leetcode.com/problems/longest-repeating-character-replacement/",
    },
    reference: `function characterReplacement(s, k) {
  const count = new Map();
  let lo = 0, top = 0, best = 0;
  for (let hi = 0; hi < s.length; hi++) {
    const c = (count.get(s[hi]) || 0) + 1;
    count.set(s[hi], c);
    top = Math.max(top, c);
    while (hi - lo + 1 - top > k) {
      count.set(s[lo], count.get(s[lo]) - 1);
      lo++;
    }
    best = Math.max(best, hi - lo + 1);
  }
  return best;
}`,
  },
  {
    slug: "peak-in-every-window",
    title: "Peak in Every Window",
    pattern: "sliding-window",
    difficulty: "hard",
    rating: 1700,
    statement: `A window of width \`k\` slides across the integer array \`nums\` one position at a time, from the far left to the far right. For each of the \`n - k + 1\` positions, record the largest value inside the window.

Return the recorded values in order. Aim for O(n) overall.`,
    constraints: ["1 <= k <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
    hints: [
      "Once a larger value enters the window, the smaller values before it can never be a window maximum again.",
      "Keep a deque of indices whose values are strictly decreasing. Before pushing index i, pop from the back every index with a value <= nums[i]; pop from the front if it fell out of the window. The front is the current maximum.",
      "dq = deque(); out = []\nfor i, x in enumerate(nums):\n    while dq and nums[dq[-1]] <= x: dq.pop()\n    dq.append(i)\n    if dq[0] <= i - k: dq.popleft()\n    if i >= k - 1: out.append(nums[dq[0]])\nreturn out",
    ],
    complexity: { time: "O(n)", space: "O(k)" },
    signature: {
      kind: "function",
      name: "maxSlidingWindow",
      params: [
        { name: "nums", type: "int[]" },
        { name: "k", type: "int" },
      ],
      returns: "int[]",
    },
    tests: [
      { input: [[1, 3, -1, -3, 5, 3, 6, 7], 3], expected: [3, 3, 5, 5, 6, 7], sample: true },
      { input: [[1], 1], expected: [1], sample: true },
      { input: [[4, 2, 12, 3], 1], expected: [4, 2, 12, 3], label: "window of one" },
      { input: [[9, 8, 7, 6], 4], expected: [9], label: "window covers everything" },
      { input: [[9, 8, 7, 6, 5], 2], expected: [9, 8, 7, 6], label: "decreasing" },
      { input: [[1, 2, 3, 4, 5], 3], expected: [3, 4, 5], label: "increasing" },
      { input: [[2, 2, 2, 2], 2], expected: [2, 2, 2], label: "all same" },
      { input: [[-7, -8, 7, 5, 7, 1, 6, 0], 4], expected: [7, 7, 7, 7, 7], label: "repeated maximum" },
      { input: [[-1, -5, -3], 2], expected: [-1, -3], label: "negatives" },
      { input: [bigWaves, 50], expected: bruteWindowMax(bigWaves, 50), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Microsoft", "Meta", "Uber"],
    source: { name: "LeetCode 239. Sliding Window Maximum", url: "https://leetcode.com/problems/sliding-window-maximum/" },
    reference: `function maxSlidingWindow(nums, k) {
  const dq = new Array(nums.length);
  let head = 0, tail = 0;
  const out = [];
  for (let i = 0; i < nums.length; i++) {
    while (tail > head && nums[dq[tail - 1]] <= nums[i]) tail--;
    dq[tail++] = i;
    if (dq[head] <= i - k) head++;
    if (i >= k - 1) out.push(nums[dq[head]]);
  }
  return out;
}`,
  },
];
