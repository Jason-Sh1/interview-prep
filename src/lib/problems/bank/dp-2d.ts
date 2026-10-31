import type { Problem } from "../types";

// Brute-force helpers (top-down recursion or repeated relaxation) for expected values.
function walkTopDown(grid: number[][]): number {
  const R = grid.length, C = grid[0].length;
  const memo = new Map<number, number>();
  const from = (r: number, c: number): number => {
    if (r === R - 1 && c === C - 1) return grid[r][c];
    const key = r * C + c;
    if (memo.has(key)) return memo.get(key)!;
    let best = Infinity;
    if (r + 1 < R) best = Math.min(best, from(r + 1, c));
    if (c + 1 < C) best = Math.min(best, from(r, c + 1));
    memo.set(key, grid[r][c] + best);
    return grid[r][c] + best;
  };
  return from(0, 0);
}

function changeWaysTopDown(amount: number, coins: number[]): number {
  const memo = new Map<string, number>();
  const ways = (i: number, left: number): number => {
    if (left === 0) return 1;
    if (i === coins.length || left < 0) return 0;
    const key = i + ":" + left;
    if (!memo.has(key)) memo.set(key, ways(i, left - coins[i]) + ways(i + 1, left));
    return memo.get(key)!;
  };
  return ways(0, amount);
}

function weaveTopDown(a: string, b: string, c: string): boolean {
  if (a.length + b.length !== c.length) return false;
  const memo = new Map<number, boolean>();
  const go = (i: number, j: number): boolean => {
    if (i + j === c.length) return true;
    const key = i * (b.length + 1) + j;
    if (memo.has(key)) return memo.get(key)!;
    const ok = (i < a.length && a[i] === c[i + j] && go(i + 1, j)) || (j < b.length && b[j] === c[i + j] && go(i, j + 1));
    memo.set(key, ok);
    return ok;
  };
  return go(0, 0);
}

function climbByRelaxing(m: number[][]): number {
  const R = m.length, C = m[0].length;
  const len = m.map((row) => row.map(() => 1));
  for (let changed = true; changed; ) {
    changed = false;
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++)
        for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]])
          if (nr >= 0 && nc >= 0 && nr < R && nc < C && m[nr][nc] > m[r][c] && len[nr][nc] + 1 > len[r][c]) {
            len[r][c] = len[nr][nc] + 1;
            changed = true;
          }
  }
  return Math.max(...len.flat());
}

function balloonsBySubsets(nums: number[]): number {
  // best[mask] = most points from bursting exactly the balloons in mask, given the rest are still there.
  const n = nums.length;
  const memo = new Map<number, number>();
  const go = (mask: number): number => {
    if (mask === 0) return 0;
    if (memo.has(mask)) return memo.get(mask)!;
    let best = 0;
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;
      let l = i - 1, r = i + 1;
      while (l >= 0 && mask & (1 << l)) l--;
      while (r < n && mask & (1 << r)) r++;
      // i is burst last within its run, so its neighbors are the nearest balloons outside the mask.
      const left = l >= 0 ? nums[l] : 1, right = r < n ? nums[r] : 1;
      best = Math.max(best, go(mask & ~(1 << i)) + left * nums[i] * right);
    }
    memo.set(mask, best);
    return best;
  };
  return go((1 << n) - 1);
}

function balloonsByLastBurst(nums: number[]): number {
  const a = [1, ...nums, 1];
  const memo = new Map<number, number>();
  const go = (lo: number, hi: number): number => {
    if (hi - lo < 2) return 0;
    const key = lo * a.length + hi;
    if (memo.has(key)) return memo.get(key)!;
    let best = 0;
    for (let k = lo + 1; k < hi; k++) best = Math.max(best, go(lo, k) + go(k, hi) + a[lo] * a[k] * a[hi]);
    memo.set(key, best);
    return best;
  };
  return go(0, a.length - 1);
}

const costGrid = Array.from({ length: 60 }, (_, r) => Array.from({ length: 60 }, (_, c) => (r * 17 + c * 31 + r * c) % 100));
const weaveA = Array.from({ length: 90 }, (_, i) => "ab"[(i * 7) % 3 === 0 ? 1 : 0]).join("");
const weaveB = Array.from({ length: 80 }, (_, i) => "abc"[(i * 5) % 3]).join("");
const woven = (() => {
  let out = "", i = 0, j = 0;
  for (let t = 0; i < weaveA.length || j < weaveB.length; t++) {
    if (j >= weaveB.length || (i < weaveA.length && (t * 13) % 5 < 3)) out += weaveA[i++];
    else out += weaveB[j++];
  }
  return out;
})();
const wovenBroken = (() => {
  // Swap two neighboring letters so the result is no longer a weave.
  for (let k = 60; k < woven.length - 1; k++) {
    if (woven[k] === woven[k + 1]) continue;
    const t = woven.slice(0, k) + woven[k + 1] + woven[k] + woven.slice(k + 2);
    if (!weaveTopDown(weaveA, weaveB, t)) return t;
  }
  return woven.slice(1) + woven[0];
})();
const terrain = Array.from({ length: 40 }, (_, r) => Array.from({ length: 40 }, (_, c) => (r * 7 + c * 11 + ((r * c) % 13)) % 60));
const tenBalloons = [3, 1, 5, 8, 2, 7, 4, 6, 9, 2];
const manyBalloons = Array.from({ length: 80 }, (_, i) => (i * 37 + 5) % 101);

export const dp2d: Problem[] = [
  {
    slug: "robot-grid-routes",
    title: "Robot Grid Routes",
    pattern: "dp-2d",
    difficulty: "easy",
    rating: 1100,
    statement: `A robot starts in the top-left cell of an \`m x n\` grid and wants to reach the bottom-right cell. On each move it can go only **right** or **down** by one cell.

Return the number of distinct routes the robot can take.`,
    constraints: ["1 <= m, n <= 100", "The answer fits in a 32-bit signed integer for every test."],
    hints: [
      "The robot enters any cell either from the cell above or the cell to its left.",
      "paths[r][c] = paths[r - 1][c] + paths[r][c - 1], with every cell in the first row and first column equal to 1. One row of the table is enough.",
      "row = [1] * n\nfor _ in range(1, m):\n    for c in range(1, n):\n        row[c] += row[c - 1]\nreturn row[-1]",
    ],
    complexity: { time: "O(m·n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "uniquePaths",
      params: [
        { name: "m", type: "int" },
        { name: "n", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: [3, 4], expected: 10, sample: true },
      { input: [2, 3], expected: 3, sample: true },
      { input: [1, 1], expected: 1, label: "single cell" },
      { input: [1, 10], expected: 1, label: "single row" },
      { input: [10, 1], expected: 1, label: "single column" },
      { input: [3, 3], expected: 6, label: "square" },
      { input: [3, 7], expected: 28 },
      { input: [23, 12], expected: 193536720, label: "large grid" },
    ],
    companies: ["Google", "Amazon", "Meta", "Bloomberg"],
    source: { name: "LeetCode 62. Unique Paths", url: "https://leetcode.com/problems/unique-paths/" },
    reference: `function uniquePaths(m, n) {
  const row = new Array(n).fill(1);
  for (let r = 1; r < m; r++) for (let c = 1; c < n; c++) row[c] += row[c - 1];
  return row[n - 1];
}`,
  },
  {
    slug: "shared-subsequence-length",
    title: "Shared Subsequence Length",
    pattern: "dp-2d",
    difficulty: "medium",
    rating: 1350,
    statement: `Given two strings \`text1\` and \`text2\`, return the length of the longest string that is a subsequence of both. Return \`0\` if they have no characters in common.

A subsequence keeps some (possibly none) of a string's characters in their original order, without needing them to be adjacent. For example, \`"tne"\` is a subsequence of \`"stone"\`.`,
    constraints: ["1 <= text1.length, text2.length <= 1000", "Both strings contain only lowercase English letters."],
    hints: [
      "Compare the last characters of the two prefixes you are looking at. What happens if they match? If they don't?",
      "dp[i][j] = LCS of text1[:i] and text2[:j]. If text1[i-1] == text2[j-1], dp[i][j] = dp[i-1][j-1] + 1; otherwise max(dp[i-1][j], dp[i][j-1]).",
      "dp = [[0] * (n + 1) for _ in range(m + 1)]\nfor i in 1..m:\n    for j in 1..n:\n        if a[i-1] == b[j-1]: dp[i][j] = dp[i-1][j-1] + 1\n        else: dp[i][j] = max(dp[i-1][j], dp[i][j-1])\nreturn dp[m][n]",
    ],
    complexity: { time: "O(m·n)", space: "O(min(m, n))" },
    signature: {
      kind: "function",
      name: "longestCommonSubsequence",
      params: [
        { name: "text1", type: "string" },
        { name: "text2", type: "string" },
      ],
      returns: "int",
    },
    tests: [
      { input: ["stone", "longest"], expected: 3, sample: true },
      { input: ["abc", "def"], expected: 0, sample: true },
      { input: ["x", "x"], expected: 1, label: "single matching character" },
      { input: ["a", "b"], expected: 0, label: "single different characters" },
      { input: ["abc", "abc"], expected: 3, label: "identical strings" },
      { input: ["ace", "abcde"], expected: 3, label: "one is a subsequence of the other" },
      { input: ["abcba", "abcbcba"], expected: 5, label: "repeated letters" },
      { input: ["bsbininm", "jmjkbkjkv"], expected: 1, label: "order matters" },
      { input: ["ab".repeat(200), "ba".repeat(200)], expected: 399, label: "long alternating" },
    ],
    companies: ["Amazon", "Google", "Microsoft", "Meta"],
    source: {
      name: "LeetCode 1143. Longest Common Subsequence",
      url: "https://leetcode.com/problems/longest-common-subsequence/",
    },
    reference: `function longestCommonSubsequence(text1, text2) {
  const m = text1.length, n = text2.length;
  let prev = new Array(n + 1).fill(0), cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      cur[j] = text1[i - 1] === text2[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    const t = prev; prev = cur; cur = t;
  }
  return prev[n];
}`,
  },
  {
    slug: "minimum-edit-steps",
    title: "Minimum Edit Steps",
    pattern: "dp-2d",
    difficulty: "hard",
    rating: 1650,
    statement: `You want to turn the string \`word1\` into \`word2\`. In one step you can:

- insert one character anywhere,
- delete one character, or
- replace one character with a different character.

Return the minimum number of steps needed.`,
    constraints: ["0 <= word1.length, word2.length <= 500", "Both strings contain only lowercase English letters."],
    hints: [
      "Look at the last characters of the two prefixes. If they are equal, they cost nothing. If not, the last step was an insert, a delete or a replace.",
      "dp[i][j] = cost to turn word1[:i] into word2[:j]. dp[i][0] = i, dp[0][j] = j. If the characters match, dp[i][j] = dp[i-1][j-1]; else 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]).",
      "dp[i][0] = i; dp[0][j] = j\nfor i in 1..m:\n    for j in 1..n:\n        if a[i-1] == b[j-1]: dp[i][j] = dp[i-1][j-1]\n        else: dp[i][j] = 1 + min(dp[i-1][j],    # delete\n                                 dp[i][j-1],    # insert\n                                 dp[i-1][j-1])  # replace\nreturn dp[m][n]",
    ],
    complexity: { time: "O(m·n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "minDistance",
      params: [
        { name: "word1", type: "string" },
        { name: "word2", type: "string" },
      ],
      returns: "int",
    },
    tests: [
      { input: ["kitten", "sitting"], expected: 3, sample: true },
      { input: ["sunday", "saturday"], expected: 3, sample: true },
      { input: ["", ""], expected: 0, label: "both empty" },
      { input: ["", "abc"], expected: 3, label: "only inserts" },
      { input: ["abc", ""], expected: 3, label: "only deletes" },
      { input: ["same", "same"], expected: 0, label: "identical" },
      { input: ["ab", "ba"], expected: 2, label: "swapped letters" },
      { input: ["intention", "execution"], expected: 5 },
      { input: ["a".repeat(60), "b".repeat(60)], expected: 60, label: "all replaces" },
      { input: ["abc".repeat(100), "abc".repeat(99)], expected: 3, label: "long strings" },
    ],
    companies: ["Google", "Amazon", "Microsoft", "Meta"],
    source: { name: "LeetCode 72. Edit Distance", url: "https://leetcode.com/problems/edit-distance/" },
    reference: `function minDistance(word1, word2) {
  const m = word1.length, n = word2.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = new Array(n + 1);
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = word1[i - 1] === word2[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}`,
  },
  {
    slug: "cheapest-grid-walk",
    title: "Cheapest Grid Walk",
    pattern: "dp-2d",
    difficulty: "medium",
    rating: 1180,
    statement: `A grid \`grid\` of non-negative integers gives the toll for entering each cell. You start in the top-left cell and must reach the bottom-right cell, moving only right or down one cell at a time.

Return the smallest possible sum of the tolls of every cell on your route, including the first and last cells.`,
    constraints: ["1 <= grid.length, grid[i].length <= 200", "0 <= grid[i][j] <= 200"],
    hints: [
      "The cheapest way into a cell comes from the cell above it or the cell to its left.",
      "best[r][c] = grid[r][c] + min(best[r - 1][c], best[r][c - 1]), with only one option along the first row and first column. One row of best values is enough if you sweep row by row.",
      "row = [inf] * C; row[0] = 0\nfor r in range(R):\n    for c in range(C):\n        left = row[c - 1] if c > 0 else inf\n        row[c] = grid[r][c] + min(row[c], left)\nreturn row[-1]",
    ],
    complexity: { time: "O(m·n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "minPathSum",
      params: [{ name: "grid", type: "int[][]" }],
      returns: "int",
    },
    tests: [
      { input: [[[1, 3, 1], [1, 5, 1], [4, 2, 1]]], expected: 7, sample: true },
      { input: [[[1, 2, 3], [4, 5, 6]]], expected: 12, sample: true },
      { input: [[[7]]], expected: 7, label: "single cell" },
      { input: [[[1, 2, 3, 4]]], expected: 10, label: "single row" },
      { input: [[[1], [2], [3]]], expected: 6, label: "single column" },
      { input: [[[0, 0], [0, 0]]], expected: 0, label: "free grid" },
      { input: [[[1, 9, 9], [1, 9, 9], [1, 1, 1]]], expected: 5, label: "go down then right" },
      { input: [[[5, 1, 1], [9, 9, 1], [9, 9, 1]]], expected: walkTopDown([[5, 1, 1], [9, 9, 1], [9, 9, 1]]), label: "go right then down" },
      { input: [costGrid], expected: walkTopDown(costGrid), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Goldman Sachs", "Microsoft"],
    source: { name: "LeetCode 64. Minimum Path Sum", url: "https://leetcode.com/problems/minimum-path-sum/" },
    reference: `function minPathSum(grid) {
  const C = grid[0].length;
  const row = new Array(C).fill(Infinity);
  row[0] = 0;
  for (const g of grid) {
    for (let c = 0; c < C; c++) {
      const left = c > 0 ? row[c - 1] : Infinity;
      row[c] = g[c] + Math.min(row[c], left);
    }
  }
  return row[C - 1];
}`,
  },
  {
    slug: "ways-to-make-change",
    title: "Ways to Make Change",
    pattern: "dp-2d",
    difficulty: "medium",
    rating: 1400,
    statement: `You have an unlimited supply of coins of each value in \`coins\` (all values distinct). Return the number of different ways to pay exactly \`amount\`.

Two ways are the same if they use the same number of coins of each value; order does not matter, so \`1 + 2\` and \`2 + 1\` count once. Paying \`0\` has exactly one way (no coins). The answer fits in a 32-bit signed integer.`,
    constraints: ["1 <= coins.length <= 300", "1 <= coins[i] <= 5000", "All coin values are distinct.", "0 <= amount <= 5000"],
    hints: [
      "To avoid counting the same set of coins in different orders, decide coin types one at a time.",
      "Let ways[a] be the number of ways to pay a using the coin types seen so far. Process coins in the outer loop and amounts in increasing order in the inner loop: ways[a] += ways[a - coin].",
      "ways = [1] + [0] * amount\nfor coin in coins:\n    for a in range(coin, amount + 1):\n        ways[a] += ways[a - coin]\nreturn ways[amount]",
    ],
    complexity: { time: "O(n·amount)", space: "O(amount)" },
    signature: {
      kind: "function",
      name: "change",
      params: [
        { name: "amount", type: "int" },
        { name: "coins", type: "int[]" },
      ],
      returns: "int",
    },
    tests: [
      { input: [5, [1, 2, 5]], expected: 4, sample: true },
      { input: [3, [2]], expected: 0, sample: true },
      { input: [10, [10]], expected: 1, label: "one exact coin" },
      { input: [0, [7]], expected: 1, label: "zero amount" },
      { input: [4, [1]], expected: 1, label: "only ones" },
      { input: [7, [2, 4]], expected: 0, label: "odd amount, even coins" },
      { input: [12, [5, 3, 1]], expected: changeWaysTopDown(12, [5, 3, 1]), label: "unsorted coins" },
      { input: [100, [3, 7, 11, 13]], expected: changeWaysTopDown(100, [3, 7, 11, 13]), label: "awkward values" },
      { input: [500, [1, 2, 5, 10, 20, 50, 100, 200]], expected: changeWaysTopDown(500, [1, 2, 5, 10, 20, 50, 100, 200]), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Microsoft", "Bloomberg"],
    source: { name: "LeetCode 518. Coin Change II", url: "https://leetcode.com/problems/coin-change-ii/" },
    reference: `function change(amount, coins) {
  const ways = new Array(amount + 1).fill(0);
  ways[0] = 1;
  for (const coin of coins) for (let a = coin; a <= amount; a++) ways[a] += ways[a - coin];
  return ways[amount];
}`,
  },
  {
    slug: "weave-two-strings",
    title: "Weave Two Strings",
    pattern: "dp-2d",
    difficulty: "medium",
    rating: 1520,
    statement: `Given strings \`s1\`, \`s2\` and \`s3\`, return \`true\` if \`s3\` can be formed by weaving \`s1\` and \`s2\` together: taking all of their characters, keeping the order of the characters within each string, but interleaving the two strings in any way.

For example, \`"aadbbcbcac"\` is a weave of \`"aabcc"\` and \`"dbbca"\`.`,
    constraints: ["0 <= s1.length, s2.length <= 100", "0 <= s3.length <= 200", "All strings consist of lowercase English letters."],
    hints: [
      "Greedily taking from whichever string matches fails when both match. You need to remember both choices.",
      "Let ok[i][j] be whether the first i characters of s1 and first j of s2 weave into the first i + j characters of s3. ok[i][j] is true if (ok[i - 1][j] and s1[i - 1] == s3[i + j - 1]) or (ok[i][j - 1] and s2[j - 1] == s3[i + j - 1]). Check lengths first.",
      "if len(s1) + len(s2) != len(s3): return False\nok = [[False] * (len(s2) + 1) for _ in range(len(s1) + 1)]\nok[0][0] = True\nfor i in range(len(s1) + 1):\n    for j in range(len(s2) + 1):\n        if i and ok[i-1][j] and s1[i-1] == s3[i+j-1]: ok[i][j] = True\n        if j and ok[i][j-1] and s2[j-1] == s3[i+j-1]: ok[i][j] = True\nreturn ok[-1][-1]",
    ],
    complexity: { time: "O(m·n)", space: "O(m·n)" },
    signature: {
      kind: "function",
      name: "isInterleave",
      params: [
        { name: "s1", type: "string" },
        { name: "s2", type: "string" },
        { name: "s3", type: "string" },
      ],
      returns: "bool",
    },
    tests: [
      { input: ["aabcc", "dbbca", "aadbbcbcac"], expected: true, sample: true },
      { input: ["aabcc", "dbbca", "aadbbbaccc"], expected: false, sample: true },
      { input: ["", "", ""], expected: true, label: "all empty" },
      { input: ["", "abc", "abc"], expected: true, label: "one side empty" },
      { input: ["a", "", "b"], expected: false, label: "wrong letter" },
      { input: ["abc", "def", "abcdefg"], expected: false, label: "length mismatch" },
      { input: ["ab", "ba", "abba"], expected: true, label: "both strings match at times" },
      { input: ["aa", "ab", "aaba"], expected: true, label: "greedy choice fails" },
      { input: ["abc", "xyz", "axbycz"], expected: true, label: "alternating" },
      { input: [weaveA, weaveB, woven], expected: weaveTopDown(weaveA, weaveB, woven), label: "large input, real weave" },
      { input: [weaveA, weaveB, wovenBroken], expected: weaveTopDown(weaveA, weaveB, wovenBroken), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Microsoft", "Apple"],
    source: { name: "LeetCode 97. Interleaving String", url: "https://leetcode.com/problems/interleaving-string/" },
    reference: `function isInterleave(s1, s2, s3) {
  const m = s1.length, n = s2.length;
  if (m + n !== s3.length) return false;
  const ok = new Array(n + 1).fill(false);
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (i === 0 && j === 0) { ok[0] = true; continue; }
      const fromS1 = i > 0 && ok[j] && s1[i - 1] === s3[i + j - 1];
      const fromS2 = j > 0 && ok[j - 1] && s2[j - 1] === s3[i + j - 1];
      ok[j] = fromS1 || fromS2;
    }
  }
  return ok[n];
}`,
  },
  {
    slug: "longest-climb-in-a-grid",
    title: "Longest Climb in a Grid",
    pattern: "dp-2d",
    difficulty: "hard",
    rating: 1720,
    statement: `Given a grid of integers \`matrix\`, find the longest path that moves between cells sharing a side (up, down, left, right) and whose values strictly increase along the way. You can start anywhere; you cannot leave the grid or move diagonally.

Return the number of cells on the longest such path.`,
    constraints: ["1 <= matrix.length, matrix[i].length <= 200", "0 <= matrix[i][j] <= 2^31 - 1"],
    hints: [
      "Because values strictly increase, a path can never loop back. The longest climb starting from a cell does not depend on how you got there.",
      "DFS with memoization: longest(r, c) = 1 + max(longest of each neighbor with a larger value), defaulting to 1. Cache it per cell and take the maximum over all cells.",
      "@cache\ndef longest(r, c):\n    best = 1\n    for nr, nc in neighbors(r, c):\n        if matrix[nr][nc] > matrix[r][c]:\n            best = max(best, 1 + longest(nr, nc))\n    return best\nreturn max(longest(r, c) for r in range(R) for c in range(C))",
    ],
    complexity: { time: "O(m·n)", space: "O(m·n)" },
    signature: {
      kind: "function",
      name: "longestIncreasingPath",
      params: [{ name: "matrix", type: "int[][]" }],
      returns: "int",
    },
    tests: [
      { input: [[[9, 9, 4], [6, 6, 8], [2, 1, 1]]], expected: 4, sample: true },
      { input: [[[3, 4, 5], [3, 2, 6], [2, 2, 1]]], expected: 4, sample: true },
      { input: [[[1]]], expected: 1, label: "single cell" },
      { input: [[[7, 7], [7, 7]]], expected: 1, label: "flat grid" },
      { input: [[[1, 2, 3, 4, 5]]], expected: 5, label: "single row" },
      { input: [[[1, 2], [4, 3]]], expected: 4, label: "loop around" },
      { input: [[[1, 2, 3], [8, 9, 4], [7, 6, 5]]], expected: 9, label: "spiral" },
      { input: [[[0, 2147483647]]], expected: 2, label: "large values" },
      { input: [terrain], expected: climbByRelaxing(terrain), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Meta", "Uber", "DoorDash"],
    source: {
      name: "LeetCode 329. Longest Increasing Path in a Matrix",
      url: "https://leetcode.com/problems/longest-increasing-path-in-a-matrix/",
    },
    reference: `function longestIncreasingPath(matrix) {
  const R = matrix.length, C = matrix[0].length;
  const memo = new Array(R * C).fill(0);
  // Process cells from highest to lowest so every larger neighbor is already settled.
  const order = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) order.push([r, c]);
  order.sort((a, b) => matrix[b[0]][b[1]] - matrix[a[0]][a[1]]);
  let best = 0;
  for (const [r, c] of order) {
    let len = 1;
    for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
      if (nr >= 0 && nc >= 0 && nr < R && nc < C && matrix[nr][nc] > matrix[r][c]) len = Math.max(len, memo[nr * C + nc] + 1);
    }
    memo[r * C + c] = len;
    best = Math.max(best, len);
  }
  return best;
}`,
  },
  {
    slug: "pop-balloons-for-the-most-points",
    title: "Pop Balloons for the Most Points",
    pattern: "dp-2d",
    difficulty: "hard",
    rating: 1800,
    statement: `Balloons in a row carry numbers \`nums\`. Popping balloon \`i\` scores \`left * nums[i] * right\` points, where \`left\` and \`right\` are the numbers on the nearest balloons still unpopped to its left and right. If there is no balloon on a side, use \`1\` for that side. After a pop, the balloons on either side become neighbors.

Pop every balloon, in whatever order you like, and return the most points you can score.`,
    constraints: ["1 <= nums.length <= 300", "0 <= nums[i] <= 100"],
    hints: [
      "Choosing the first balloon to pop changes everyone's neighbors in messy ways. What if you choose the last balloon to pop in a range instead?",
      "Pad the row with 1 at both ends. Let best(lo, hi) be the most points from popping everything strictly between lo and hi. If k is popped last there, its neighbors are lo and hi: best(lo, hi) = max over k of best(lo, k) + best(k, hi) + a[lo]·a[k]·a[hi].",
      "a = [1] + nums + [1]; n = len(a)\nbest = [[0] * n for _ in range(n)]\nfor gap in range(2, n):\n    for lo in range(n - gap):\n        hi = lo + gap\n        best[lo][hi] = max(best[lo][k] + best[k][hi] + a[lo] * a[k] * a[hi]\n                           for k in range(lo + 1, hi))\nreturn best[0][n - 1]",
    ],
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    signature: {
      kind: "function",
      name: "maxCoins",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[3, 1, 5, 8]], expected: 167, sample: true },
      { input: [[1, 5]], expected: 10, sample: true },
      { input: [[7]], expected: 7, label: "single balloon" },
      { input: [[0, 0, 0]], expected: 0, label: "all zero" },
      { input: [[2, 3]], expected: 9, label: "two balloons" },
      { input: [[1, 1, 1, 1]], expected: 4, label: "all ones" },
      { input: [[9, 0, 9]], expected: balloonsBySubsets([9, 0, 9]), label: "zero in the middle" },
      { input: [tenBalloons], expected: balloonsBySubsets(tenBalloons), label: "ten balloons" },
      { input: [manyBalloons], expected: balloonsByLastBurst(manyBalloons), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Microsoft", "Snap"],
    source: { name: "LeetCode 312. Burst Balloons", url: "https://leetcode.com/problems/burst-balloons/" },
    reference: `function maxCoins(nums) {
  const a = [1, ...nums, 1];
  const n = a.length;
  const best = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let gap = 2; gap < n; gap++) {
    for (let lo = 0; lo + gap < n; lo++) {
      const hi = lo + gap;
      let top = 0;
      for (let k = lo + 1; k < hi; k++) top = Math.max(top, best[lo][k] + best[k][hi] + a[lo] * a[k] * a[hi]);
      best[lo][hi] = top;
    }
  }
  return best[0][n - 1];
}`,
  },
];
