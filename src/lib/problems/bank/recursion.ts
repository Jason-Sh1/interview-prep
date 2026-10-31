import type { Problem } from "../types";

// Brute-force helpers used to compute expected values for the larger tests.
function simulateCircle(n: number, k: number): number {
  const players = Array.from({ length: n }, (_, i) => i + 1);
  let at = 0;
  while (players.length > 1) {
    at = (at + k - 1) % players.length;
    players.splice(at, 1);
  }
  return players[0];
}

function bitRowSymbol(n: number, k: number): number {
  // Build the row directly for small n; for large n count the flips on the way up.
  if (n <= 12) {
    let row = "0";
    for (let i = 1; i < n; i++) row = [...row].map((c) => (c === "0" ? "01" : "10")).join("");
    return Number(row[k - 1]);
  }
  let flips = 0;
  let pos = k - 1;
  while (pos > 0) {
    if (pos % 2 === 1) flips++;
    pos = Math.floor(pos / 2);
  }
  return flips % 2;
}

function duelMargin(nums: number[], lo: number, hi: number): number {
  if (lo === hi) return nums[lo];
  return Math.max(nums[lo] - duelMargin(nums, lo + 1, hi), nums[hi] - duelMargin(nums, lo, hi - 1));
}
const firstCanWin = (nums: number[]) => duelMargin(nums, 0, nums.length - 1) >= 0;

function isScrambleBrute(a: string, b: string, memo = new Map<string, boolean>()): boolean {
  const key = a + "|" + b;
  if (memo.has(key)) return memo.get(key)!;
  let ok = a === b;
  if (!ok && [...a].sort().join("") === [...b].sort().join("")) {
    for (let i = 1; i < a.length && !ok; i++) {
      ok =
        (isScrambleBrute(a.slice(0, i), b.slice(0, i), memo) && isScrambleBrute(a.slice(i), b.slice(i), memo)) ||
        (isScrambleBrute(a.slice(0, i), b.slice(b.length - i), memo) &&
          isScrambleBrute(a.slice(i), b.slice(0, b.length - i), memo));
    }
  }
  memo.set(key, ok);
  return ok;
}

// A genuine scramble: split at fixed points and swap some halves.
function scrambleOf(s: string, depth: number): string {
  if (s.length <= 1 || depth === 0) return s;
  const cut = Math.max(1, Math.floor(s.length / 3));
  const left = scrambleOf(s.slice(0, cut), depth - 1);
  const right = scrambleOf(s.slice(cut), depth - 1);
  return depth % 2 === 1 ? right + left : left + right;
}

const duelCards = Array.from({ length: 16 }, (_, i) => (i * 7919 + 13) % 1000);
const longWord = "thequickbrownfoxjumpsoverlazyd";
const longScramble = scrambleOf(longWord, 6);
const longNotScramble = longWord.slice(0, 15).split("").reverse().join("").slice(1) + longWord.slice(15) + longWord[14];

export const recursion: Problem[] = [
  {
    slug: "golden-sequence-term",
    title: "Golden Sequence Term",
    pattern: "recursion",
    difficulty: "easy",
    rating: 950,
    statement: `A number sequence starts with \`0\` and \`1\`. Every later term is the sum of the two terms right before it, so the sequence begins \`0, 1, 1, 2, 3, 5, 8, ...\`.

Given \`n\`, return the term at position \`n\` (positions start at 0).

A plain recursive solution recomputes the same terms an exponential number of times. Make yours fast enough for \`n = 45\`.`,
    constraints: ["0 <= n <= 45"],
    hints: [
      "Write the definition as a recursive function first. How many times does it compute term 2 when n = 10?",
      "Cache each term the first time you compute it (memoization), or build the terms bottom-up keeping only the last two.",
      "memo = {0: 0, 1: 1}\ndef f(n):\n    if n not in memo:\n        memo[n] = f(n - 1) + f(n - 2)\n    return memo[n]",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "fib",
      params: [{ name: "n", type: "int" }],
      returns: "int",
    },
    tests: [
      { input: [4], expected: 3, sample: true },
      { input: [10], expected: 55, sample: true },
      { input: [0], expected: 0, label: "first term" },
      { input: [1], expected: 1, label: "second term" },
      { input: [2], expected: 1, label: "smallest sum" },
      { input: [20], expected: 6765, label: "medium n" },
      { input: [30], expected: 832040, label: "larger n" },
      { input: [45], expected: 1134903170, label: "largest n (needs memo)" },
    ],
    companies: ["Amazon", "Microsoft", "Apple", "Adobe"],
    source: { name: "LeetCode 509. Fibonacci Number", url: "https://leetcode.com/problems/fibonacci-number/" },
    reference: `function fib(n) {
  if (n < 2) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    const c = a + b;
    a = b;
    b = c;
  }
  return b;
}`,
  },
  {
    slug: "fast-exponent",
    title: "Fast Exponent",
    pattern: "recursion",
    difficulty: "medium",
    rating: 1320,
    statement: `Given a real number \`x\` and an integer \`n\`, compute \`x\` raised to the power \`n\` without using a built-in power function.

\`n\` may be negative (then the answer is \`1 / x^|n|\`) and can be as large as about two billion in absolute value, so multiplying \`x\` by itself \`n\` times is far too slow. Answers are checked to within \`1e-5\`.`,
    constraints: [
      "-100.0 < x < 100.0",
      "-2^31 <= n <= 2^31 - 1",
      "x is not 0 when n is negative",
      "-10^4 <= x^n <= 10^4",
    ],
    hints: [
      "x^10 = (x^5)^2. How does that let you halve the exponent each step?",
      "Recurse on n // 2: square the half result, and multiply by one extra x when n is odd. For negative n, compute with -n and take the reciprocal.",
      "def pow(x, n):\n    if n < 0: return 1 / pow(x, -n)\n    if n == 0: return 1\n    half = pow(x, n // 2)\n    return half * half * (x if n % 2 else 1)",
    ],
    complexity: { time: "O(log n)", space: "O(log n)" },
    signature: {
      kind: "function",
      name: "myPow",
      params: [
        { name: "x", type: "float" },
        { name: "n", type: "int" },
      ],
      returns: "float",
      compare: "float",
    },
    tests: [
      { input: [2.0, 10], expected: 1024.0, sample: true },
      { input: [2.0, -2], expected: 0.25, sample: true },
      { input: [2.1, 3], expected: 9.261, label: "fractional base" },
      { input: [5.0, 0], expected: 1.0, label: "zero exponent" },
      { input: [-2.0, 3], expected: -8.0, label: "negative base, odd power" },
      { input: [-2.0, 4], expected: 16.0, label: "negative base, even power" },
      { input: [1.0, 2147483647], expected: 1.0, label: "huge exponent" },
      { input: [-1.0, -2147483647], expected: -1.0, label: "huge negative odd exponent" },
      { input: [2.0, -2147483648], expected: 0.0, label: "most negative exponent" },
      { input: [0.5, 4], expected: 0.0625, label: "base below one" },
    ],
    companies: ["Meta", "Google", "Amazon", "LinkedIn", "Bloomberg"],
    source: { name: "LeetCode 50. Pow(x, n)", url: "https://leetcode.com/problems/powx-n/" },
    reference: `function myPow(x, n) {
  function go(b, e) {
    if (e === 0) return 1;
    const half = go(b, Math.floor(e / 2));
    return e % 2 === 1 ? half * half * b : half * half;
  }
  return n < 0 ? 1 / go(x, -n) : go(x, n);
}`,
  },
  {
    slug: "every-bracketing-result",
    title: "Every Bracketing Result",
    pattern: "recursion",
    difficulty: "medium",
    rating: 1620,
    statement: `You get an arithmetic expression \`expression\` made of non-negative integers joined by the operators \`+\`, \`-\` and \`*\` (no spaces, no parentheses).

Imagine inserting parentheses in every possible way so that the order of evaluation is fully determined. Return the value produced by each distinct way of bracketing, in any order. Two different bracketings that happen to produce the same number each contribute their own entry, so the output can contain repeated values.`,
    constraints: [
      "1 <= expression.length <= 20",
      "expression contains only digits and the characters '+', '-', '*'",
      "Every number in the expression is between 0 and 99",
      "The output has at most 10^4 values",
    ],
    hints: [
      "Whichever operator is evaluated last splits the expression into a left part and a right part.",
      "For each operator position, recursively get all values of the left side and all values of the right side, then combine every pair. Memoize by substring (start, end) since the same pieces recur.",
      "def ways(s):\n    if s is a number: return [int(s)]\n    out = []\n    for i, c in enumerate(s):\n        if c in '+-*':\n            for a in ways(s[:i]):\n                for b in ways(s[i+1:]):\n                    out.append(apply(c, a, b))\n    return out  # cache by s",
    ],
    complexity: { time: "O(C_n * n)", space: "O(C_n * n)" },
    signature: {
      kind: "function",
      name: "diffWaysToCompute",
      params: [{ name: "expression", type: "string" }],
      returns: "int[]",
      compare: "unordered",
    },
    tests: [
      { input: ["2-1-1"], expected: [0, 2], sample: true },
      { input: ["2*3-4*5"], expected: [-34, -14, -10, -10, 10], sample: true },
      { input: ["7"], expected: [7], label: "single number" },
      { input: ["11"], expected: [11], label: "multi-digit number" },
      { input: ["2*3"], expected: [6], label: "one operator" },
      { input: ["1+2+3"], expected: [6, 6], label: "repeated values" },
      { input: ["10-5*2"], expected: [10, 0], label: "precedence ignored" },
      { input: ["1-2-3-4"], expected: [-8, -2, 0, 6, -2], label: "negative results" },
      { input: ["0*99"], expected: [0], label: "zero operand" },
    ],
    companies: ["Google", "Amazon", "Bloomberg", "Uber"],
    source: {
      name: "LeetCode 241. Different Ways to Add Parentheses",
      url: "https://leetcode.com/problems/different-ways-to-add-parentheses/",
    },
    reference: `function diffWaysToCompute(expression) {
  const memo = new Map();
  function go(lo, hi) {
    const key = lo + ":" + hi;
    if (memo.has(key)) return memo.get(key);
    const out = [];
    for (let i = lo; i < hi; i++) {
      const c = expression[i];
      if (c === "+" || c === "-" || c === "*") {
        const left = go(lo, i);
        const right = go(i + 1, hi);
        for (const a of left) {
          for (const b of right) {
            out.push(c === "+" ? a + b : c === "-" ? a - b : a * b);
          }
        }
      }
    }
    if (out.length === 0) out.push(Number(expression.slice(lo, hi)));
    memo.set(key, out);
    return out;
  }
  return go(0, expression.length);
}`,
  },
  {
    slug: "three-term-sequence",
    title: "Three-Term Sequence",
    pattern: "recursion",
    difficulty: "easy",
    rating: 1020,
    statement: `A sequence starts \`0, 1, 1\`. From then on, every term is the sum of the three terms just before it, so it continues \`2, 4, 7, 13, 24, ...\`.

Given \`n\`, return the term at position \`n\` (positions start at 0). The answer always fits in a 32-bit signed integer.`,
    constraints: ["0 <= n <= 37"],
    hints: [
      "The definition is recursive, but the naive recursion branches three ways. How often does it recompute the same term?",
      "Memoize each term, or go bottom-up keeping only the last three values and sliding them forward.",
      "if n == 0: return 0\nif n <= 2: return 1\na, b, c = 0, 1, 1\nfor _ in range(n - 2):\n    a, b, c = b, c, a + b + c\nreturn c",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "tribonacci",
      params: [{ name: "n", type: "int" }],
      returns: "int",
    },
    tests: [
      { input: [4], expected: 4, sample: true },
      { input: [25], expected: 1389537, sample: true },
      { input: [0], expected: 0, label: "first term" },
      { input: [1], expected: 1, label: "second term" },
      { input: [2], expected: 1, label: "third term" },
      { input: [3], expected: 2, label: "first sum" },
      { input: [10], expected: 149, label: "small n" },
      { input: [37], expected: 2082876103, label: "largest n (needs memo)" },
    ],
    companies: ["Amazon", "Microsoft", "Adobe"],
    source: { name: "LeetCode 1137. N-th Tribonacci Number", url: "https://leetcode.com/problems/n-th-tribonacci-number/" },
    reference: `function tribonacci(n) {
  if (n === 0) return 0;
  if (n <= 2) return 1;
  let a = 0, b = 1, c = 1;
  for (let i = 3; i <= n; i++) {
    const d = a + b + c;
    a = b;
    b = c;
    c = d;
  }
  return c;
}`,
  },
  {
    slug: "last-player-standing",
    title: "Last Player Standing",
    pattern: "recursion",
    difficulty: "medium",
    rating: 1250,
    statement: `\`n\` players numbered \`1\` to \`n\` sit in a circle in clockwise order. Starting with player \`1\`, count \`k\` players clockwise, counting the player you start on as the first. The player you land on leaves the circle, and counting starts again from the player just clockwise of them.

Keep going until one player is left, and return that player's number.`,
    constraints: ["1 <= k <= n <= 500"],
    hints: [
      "After the first player leaves, you have the same game with n - 1 players, just relabeled. How do the labels shift?",
      "Let f(n) be the 0-based winner's seat for n players. Removing one player and restarting k seats later gives f(n) = (f(n - 1) + k) % n, with f(1) = 0. Add 1 at the end.",
      "def winner(n, k):\n    seat = 0          # f(1)\n    for size in range(2, n + 1):\n        seat = (seat + k) % size\n    return seat + 1",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "findTheWinner",
      params: [
        { name: "n", type: "int" },
        { name: "k", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: [5, 2], expected: 3, sample: true },
      { input: [6, 5], expected: 1, sample: true },
      { input: [1, 1], expected: 1, label: "single player" },
      { input: [2, 1], expected: 2, label: "k = 1 removes in order" },
      { input: [2, 2], expected: 1, label: "two players" },
      { input: [3, 3], expected: 2, label: "k equals n" },
      { input: [7, 3], expected: 4, label: "classic circle" },
      { input: [10, 1], expected: 10, label: "last seat wins" },
      { input: [500, 500], expected: simulateCircle(500, 500), label: "large input" },
      { input: [499, 37], expected: simulateCircle(499, 37), label: "large input, small k" },
    ],
    companies: ["Amazon", "Goldman Sachs", "Bloomberg", "Microsoft"],
    source: {
      name: "LeetCode 1823. Find the Winner of the Circular Game",
      url: "https://leetcode.com/problems/find-the-winner-of-the-circular-game/",
    },
    reference: `function findTheWinner(n, k) {
  let seat = 0;
  for (let size = 2; size <= n; size++) seat = (seat + k) % size;
  return seat + 1;
}`,
  },
  {
    slug: "doubling-bit-rows",
    title: "Doubling Bit Rows",
    pattern: "recursion",
    difficulty: "medium",
    rating: 1420,
    statement: `Build a table of rows. Row 1 is the single symbol \`0\`. Each later row comes from the row above it by replacing every \`0\` with \`01\` and every \`1\` with \`10\`, so row 2 is \`01\`, row 3 is \`0110\`, and row 4 is \`01101001\`.

Given \`n\` and \`k\`, return the \`k\`-th symbol (1-indexed) of row \`n\`. Row 30 has over half a billion symbols, so do not build it.`,
    constraints: ["1 <= n <= 30", "1 <= k <= 2^(n - 1)"],
    hints: [
      "Symbol k of row n comes from exactly one symbol of row n - 1. Which one?",
      "Its parent is symbol ceil(k / 2) of row n - 1. A left child (odd k) copies the parent; a right child (even k) is the flipped parent. Recurse until row 1.",
      "def kth(n, k):\n    if n == 1: return 0\n    parent = kth(n - 1, (k + 1) // 2)\n    return parent if k % 2 == 1 else 1 - parent",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "kthGrammar",
      params: [
        { name: "n", type: "int" },
        { name: "k", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: [2, 1], expected: 0, sample: true },
      { input: [2, 2], expected: 1, sample: true },
      { input: [1, 1], expected: 0, label: "first row" },
      { input: [3, 3], expected: 1, label: "row 3" },
      { input: [3, 4], expected: 0, label: "last of row 3" },
      { input: [4, 5], expected: bitRowSymbol(4, 5), label: "row 4 middle" },
      { input: [10, 300], expected: bitRowSymbol(10, 300), label: "row 10" },
      { input: [30, 1], expected: 0, label: "first of the largest row" },
      { input: [30, 536870912], expected: bitRowSymbol(30, 536870912), label: "last of the largest row" },
      { input: [30, 434991989], expected: bitRowSymbol(30, 434991989), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Google"],
    source: { name: "LeetCode 779. K-th Symbol in Grammar", url: "https://leetcode.com/problems/k-th-symbol-in-grammar/" },
    reference: `function kthGrammar(n, k) {
  if (n === 1) return 0;
  const parent = kthGrammar(n - 1, Math.ceil(k / 2));
  return k % 2 === 1 ? parent : 1 - parent;
}`,
  },
  {
    slug: "ends-only-card-duel",
    title: "Ends-Only Card Duel",
    pattern: "recursion",
    difficulty: "medium",
    rating: 1520,
    statement: `Cards with values \`nums\` lie in a row. Two players take turns, the first player going first. On each turn, a player takes one card from either end of the row and adds its value to their score. The game ends when the row is empty.

Both players play as well as possible. Return \`true\` if the first player finishes with a score at least as high as the second player's (a tie counts as a win for the first player), and \`false\` otherwise.`,
    constraints: ["1 <= nums.length <= 20", "0 <= nums[i] <= 10^7"],
    hints: [
      "Instead of tracking two scores, track how far ahead the player to move can get on the remaining cards.",
      "Let best(lo, hi) be the most the mover can finish ahead using cards lo..hi. Taking an end card gains its value, then the opponent gets best on the rest: best(lo, hi) = max(nums[lo] - best(lo + 1, hi), nums[hi] - best(lo, hi - 1)). Memoize on (lo, hi).",
      "@cache\ndef best(lo, hi):\n    if lo == hi: return nums[lo]\n    return max(nums[lo] - best(lo + 1, hi),\n               nums[hi] - best(lo, hi - 1))\nreturn best(0, len(nums) - 1) >= 0",
    ],
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    signature: {
      kind: "function",
      name: "predictTheWinner",
      params: [{ name: "nums", type: "int[]" }],
      returns: "bool",
    },
    tests: [
      { input: [[1, 5, 2]], expected: false, sample: true },
      { input: [[1, 5, 233, 7]], expected: true, sample: true },
      { input: [[5]], expected: true, label: "single card" },
      { input: [[0, 0]], expected: true, label: "tie counts as a win" },
      { input: [[3, 9]], expected: true, label: "two cards" },
      { input: [[2, 4, 55, 6, 8]], expected: firstCanWin([2, 4, 55, 6, 8]), label: "odd count" },
      { input: [[1, 1, 1]], expected: true, label: "all equal" },
      { input: [[1, 100, 1]], expected: false, label: "big middle card" },
      { input: [[10000000, 0, 0, 10000000, 1]], expected: firstCanWin([10000000, 0, 0, 10000000, 1]), label: "large values" },
      { input: [duelCards], expected: firstCanWin(duelCards), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Uber", "Microsoft"],
    source: { name: "LeetCode 486. Predict the Winner", url: "https://leetcode.com/problems/predict-the-winner/" },
    reference: `function predictTheWinner(nums) {
  const n = nums.length;
  const best = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) best[i][i] = nums[i];
  for (let len = 2; len <= n; len++) {
    for (let lo = 0; lo + len - 1 < n; lo++) {
      const hi = lo + len - 1;
      best[lo][hi] = Math.max(nums[lo] - best[lo + 1][hi], nums[hi] - best[lo][hi - 1]);
    }
  }
  return best[0][n - 1] >= 0;
}`,
  },
  {
    slug: "split-and-swap-strings",
    title: "Split-and-Swap Strings",
    pattern: "recursion",
    difficulty: "hard",
    rating: 1780,
    statement: `You can **shuffle** a string \`t\` like this:

- If \`t\` has length 1, it stays as it is.
- Otherwise, cut \`t\` into two non-empty parts \`x\` and \`y\` (so \`t = x + y\`). Then either keep the order (\`x + y\`) or swap the parts (\`y + x\`), and shuffle each part on its own, recursively.

Given two strings \`s1\` and \`s2\` of the same length, return \`true\` if \`s2\` can be produced by shuffling \`s1\`, and \`false\` otherwise.`,
    constraints: ["s1.length == s2.length", "1 <= s1.length <= 30", "s1 and s2 consist of lowercase English letters."],
    hints: [
      "Try every cut point in s1. After the cut, the first part of s1 must become either the first part or the last part of s2, with the same length.",
      "Recurse on substrings: for cut i, check (prefix↔prefix and suffix↔suffix) or (prefix of s1 ↔ suffix of s2 and suffix of s1 ↔ prefix of s2). Memoize on (start1, start2, length), and prune when the letter counts differ.",
      "@cache\ndef ok(i, j, n):   # s1[i:i+n] vs s2[j:j+n]\n    if s1[i:i+n] == s2[j:j+n]: return True\n    if sorted(s1[i:i+n]) != sorted(s2[j:j+n]): return False\n    for k in range(1, n):\n        if ok(i, j, k) and ok(i+k, j+k, n-k): return True\n        if ok(i, j+n-k, k) and ok(i+k, j, n-k): return True\n    return False\nreturn ok(0, 0, len(s1))",
    ],
    complexity: { time: "O(n^4)", space: "O(n^3)" },
    signature: {
      kind: "function",
      name: "isScramble",
      params: [
        { name: "s1", type: "string" },
        { name: "s2", type: "string" },
      ],
      returns: "bool",
    },
    tests: [
      { input: ["great", "rgeat"], expected: true, sample: true },
      { input: ["abcde", "caebd"], expected: false, sample: true },
      { input: ["a", "a"], expected: true, label: "single letter" },
      { input: ["ab", "ba"], expected: true, label: "one swap" },
      { input: ["abc", "bca"], expected: true, label: "swap at the first cut" },
      { input: ["abcd", "bdac"], expected: false, label: "same letters, unreachable" },
      { input: ["aabb", "abab"], expected: isScrambleBrute("aabb", "abab"), label: "repeated letters" },
      { input: ["abc", "abd"], expected: false, label: "different letters" },
      { input: [longWord, longScramble], expected: isScrambleBrute(longWord, longScramble), label: "large input, real shuffle" },
      { input: [longWord, longNotScramble], expected: isScrambleBrute(longWord, longNotScramble), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Meta", "Apple"],
    source: { name: "LeetCode 87. Scramble String", url: "https://leetcode.com/problems/scramble-string/" },
    reference: `function isScramble(s1, s2) {
  const memo = new Map();
  function ok(i, j, n) {
    const key = i * 961 + j * 31 + n;
    if (memo.has(key)) return memo.get(key);
    let res = false;
    if (s1.substr(i, n) === s2.substr(j, n)) res = true;
    else {
      const count = new Array(26).fill(0);
      for (let t = 0; t < n; t++) {
        count[s1.charCodeAt(i + t) - 97]++;
        count[s2.charCodeAt(j + t) - 97]--;
      }
      if (count.every((c) => c === 0)) {
        for (let k = 1; k < n && !res; k++) {
          res = (ok(i, j, k) && ok(i + k, j + k, n - k)) || (ok(i, j + n - k, k) && ok(i + k, j, n - k));
        }
      }
    }
    memo.set(key, res);
    return res;
  }
  return ok(0, 0, s1.length);
}`,
  },
];
