import type { Problem } from "../types";

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
];
