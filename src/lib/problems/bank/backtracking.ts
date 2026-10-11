import type { Problem } from "../types";

// Expected values for the larger tests, built independently of the references.
function powerSet(nums: number[]): number[][] {
  const out: number[][] = [];
  for (let mask = 0; mask < 1 << nums.length; mask++) {
    out.push(nums.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

function queenBoards(n: number): string[][] {
  const out: string[][] = [];
  const perm = Array.from({ length: n }, (_, i) => i);
  // Try every permutation of columns (n <= 6 here) and keep the diagonal-safe ones.
  const permute = (k: number) => {
    if (k === n) {
      for (let a = 0; a < n; a++)
        for (let b = a + 1; b < n; b++) if (Math.abs(perm[a] - perm[b]) === b - a) return;
      out.push(perm.map((c) => ".".repeat(c) + "Q" + ".".repeat(n - c - 1)));
      return;
    }
    for (let i = k; i < n; i++) {
      [perm[k], perm[i]] = [perm[i], perm[k]];
      permute(k + 1);
      [perm[k], perm[i]] = [perm[i], perm[k]];
    }
  };
  permute(0);
  return out;
}

export const backtracking: Problem[] = [
  {
    slug: "every-sub-collection",
    title: "Every Sub-Collection",
    pattern: "backtracking",
    difficulty: "easy",
    rating: 1120,
    statement: `Given an array \`nums\` of distinct integers, return every possible sub-collection of its elements (including the empty one and the full array).

Each sub-collection must appear exactly once. Both the order of the sub-collections and the order of values inside each one are up to you.`,
    constraints: [
      "0 <= nums.length <= 10",
      "-10 <= nums[i] <= 10",
      "All values in nums are distinct",
    ],
    hints: [
      "Each element is either in a sub-collection or not. How many sub-collections does that give?",
      "Backtrack over the indices: at index i, branch into 'skip nums[i]' and 'take nums[i]'. Record the current pick when i reaches the end.",
      "res, cur = [], []\ndef go(i):\n    if i == len(nums): res.append(cur[:]); return\n    go(i + 1)\n    cur.append(nums[i]); go(i + 1); cur.pop()\ngo(0)",
    ],
    complexity: { time: "O(n * 2^n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "subsets",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int[][]",
      compare: "unordered-nested",
    },
    tests: [
      {
        input: [[1, 2, 3]],
        expected: [[], [1], [2], [1, 2], [3], [1, 3], [2, 3], [1, 2, 3]],
        sample: true,
      },
      { input: [[0]], expected: [[], [0]], sample: true },
      { input: [[]], expected: [[]], label: "empty input" },
      { input: [[-1, 2]], expected: [[], [-1], [2], [-1, 2]], label: "negatives" },
      { input: [[5, 4]], expected: [[], [5], [4], [5, 4]], label: "unsorted input" },
      { input: [[1, 2, 3, 4]], expected: powerSet([1, 2, 3, 4]), label: "four elements" },
      {
        input: [[9, -3, 0, 7, -10, 2, 5, 1, -6, 10]],
        expected: powerSet([9, -3, 0, 7, -10, 2, 5, 1, -6, 10]),
        label: "largest input",
      },
    ],
    companies: ["Meta", "Amazon", "Google", "Bloomberg"],
    source: { name: "LeetCode 78. Subsets", url: "https://leetcode.com/problems/subsets/" },
    reference: `function subsets(nums) {
  const res = [], cur = [];
  function go(i) {
    if (i === nums.length) { res.push(cur.slice()); return; }
    go(i + 1);
    cur.push(nums[i]);
    go(i + 1);
    cur.pop();
  }
  go(0);
  return res;
}`,
  },
  {
    slug: "reusable-coin-totals",
    title: "Reusable Coin Totals",
    pattern: "backtracking",
    difficulty: "medium",
    rating: 1350,
    statement: `You have coin types with the distinct positive values in \`candidates\`, and an unlimited supply of each. Return every distinct combination of coins whose values add up to exactly \`target\`.

Two combinations are the same if they use the same number of each coin type, regardless of order. Return the combinations in any order, with the values inside each combination in any order. If no combination works, return an empty list.`,
    constraints: [
      "1 <= candidates.length <= 30",
      "1 <= candidates[i] <= 40",
      "All values in candidates are distinct",
      "1 <= target <= 40",
    ],
    hints: [
      "To avoid listing [2, 3] and [3, 2] separately, only ever pick coins in a fixed order.",
      "Backtrack with a start index: at each step, try coins from index start onward, and recurse with the same index (so the coin can be reused). Stop when the remaining amount is 0 (record) or negative (prune).",
      "def go(start, remain):\n    if remain == 0: res.append(cur[:]); return\n    for i in range(start, len(c)):\n        if c[i] <= remain:\n            cur.append(c[i]); go(i, remain - c[i]); cur.pop()",
    ],
    complexity: { time: "O(n^(t/m))", space: "O(t/m)" },
    signature: {
      kind: "function",
      name: "combinationSum",
      params: [
        { name: "candidates", type: "int[]" },
        { name: "target", type: "int" },
      ],
      returns: "int[][]",
      compare: "unordered-nested",
    },
    tests: [
      { input: [[2, 3, 6, 7], 7], expected: [[2, 2, 3], [7]], sample: true },
      { input: [[2, 3, 5], 8], expected: [[2, 2, 2, 2], [2, 3, 3], [3, 5]], sample: true },
      { input: [[2], 1], expected: [], label: "no combination" },
      { input: [[1], 2], expected: [[1, 1]], label: "single coin reused" },
      { input: [[3], 9], expected: [[3, 3, 3]], label: "one coin, many times" },
      { input: [[6, 9], 5], expected: [], label: "all coins too big" },
      { input: [[5, 10], 15], expected: [[5, 5, 5], [5, 10]], label: "two coins" },
      {
        input: [[4, 2, 8], 8],
        expected: [[2, 2, 2, 2], [2, 2, 4], [4, 4], [8]],
        label: "unsorted candidates",
      },
    ],
    companies: ["Amazon", "Airbnb", "Meta", "Uber", "Microsoft"],
    source: { name: "LeetCode 39. Combination Sum", url: "https://leetcode.com/problems/combination-sum/" },
    reference: `function combinationSum(candidates, target) {
  const c = candidates.slice().sort((a, b) => a - b);
  const res = [], cur = [];
  function go(start, remain) {
    if (remain === 0) { res.push(cur.slice()); return; }
    for (let i = start; i < c.length && c[i] <= remain; i++) {
      cur.push(c[i]);
      go(i, remain - c[i]);
      cur.pop();
    }
  }
  go(0, target);
  return res;
}`,
  },
  {
    slug: "peaceful-queens",
    title: "Peaceful Queens",
    pattern: "backtracking",
    difficulty: "hard",
    rating: 1760,
    statement: `Place \`n\` chess queens on an \`n x n\` board so that no two of them attack each other: no two share a row, a column, or a diagonal.

Return every such placement. Describe a board as a list of \`n\` strings, one per row from top to bottom, where \`'Q'\` marks a queen and \`'.'\` marks an empty square. The boards may be listed in any order.`,
    constraints: ["1 <= n <= 9"],
    hints: [
      "Every row holds exactly one queen, so decide the queens row by row.",
      "Backtrack over rows. Keep sets of used columns, used 'row - col' diagonals and used 'row + col' anti-diagonals so each safety check is O(1). Undo the choice after recursing.",
      "def go(r):\n    if r == n: res.append(render(cols)); return\n    for c in range(n):\n        if c in col or r-c in d1 or r+c in d2: continue\n        place(r, c); go(r + 1); remove(r, c)",
    ],
    complexity: { time: "O(n!)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "solveNQueens",
      params: [{ name: "n", type: "int" }],
      returns: "string[][]",
      compare: "unordered",
    },
    tests: [
      {
        input: [4],
        expected: [
          [".Q..", "...Q", "Q...", "..Q."],
          ["..Q.", "Q...", "...Q", ".Q.."],
        ],
        sample: true,
      },
      { input: [1], expected: [["Q"]], sample: true },
      { input: [2], expected: [], label: "no solution (n = 2)" },
      { input: [3], expected: [], label: "no solution (n = 3)" },
      { input: [5], expected: queenBoards(5), label: "n = 5 (10 boards)" },
      { input: [6], expected: queenBoards(6), label: "n = 6 (4 boards)" },
      { input: [7], expected: queenBoards(7), label: "n = 7 (40 boards)" },
    ],
    companies: ["Amazon", "Microsoft", "Google", "Meta"],
    source: { name: "LeetCode 51. N-Queens", url: "https://leetcode.com/problems/n-queens/" },
    reference: `function solveNQueens(n) {
  const res = [], pos = [];
  const cols = new Set(), d1 = new Set(), d2 = new Set();
  function go(r) {
    if (r === n) {
      res.push(pos.map((c) => ".".repeat(c) + "Q" + ".".repeat(n - c - 1)));
      return;
    }
    for (let c = 0; c < n; c++) {
      if (cols.has(c) || d1.has(r - c) || d2.has(r + c)) continue;
      cols.add(c); d1.add(r - c); d2.add(r + c); pos.push(c);
      go(r + 1);
      cols.delete(c); d1.delete(r - c); d2.delete(r + c); pos.pop();
    }
  }
  go(0);
  return res;
}`,
  },
];
