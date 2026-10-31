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

// Brute-force enumerators for expected values (bitmasks and insertion, no backtracking).
function allOrderings(nums: number[]): number[][] {
  let out: number[][] = [[]];
  for (const x of nums) {
    const next: number[][] = [];
    for (const p of out) for (let i = 0; i <= p.length; i++) next.push([...p.slice(0, i), x, ...p.slice(i)]);
    out = next;
  }
  return out;
}

function distinctSubsets(nums: number[]): number[][] {
  const seen = new Map<string, number[]>();
  for (let mask = 0; mask < 1 << nums.length; mask++) {
    const pick = nums.filter((_, i) => mask & (1 << i)).sort((a, b) => a - b);
    seen.set(pick.join(","), pick);
  }
  return [...seen.values()];
}

function singleUseTotals(candidates: number[], target: number): number[][] {
  const seen = new Map<string, number[]>();
  for (let mask = 0; mask < 1 << candidates.length; mask++) {
    const pick = candidates.filter((_, i) => mask & (1 << i));
    if (pick.reduce((a, b) => a + b, 0) === target) {
      pick.sort((a, b) => a - b);
      seen.set(pick.join(","), pick);
    }
  }
  return [...seen.values()];
}

function mirrorSplits(s: string): string[][] {
  const out: string[][] = [];
  const isMirror = (t: string) => t === [...t].reverse().join("");
  for (let mask = 0; mask < 1 << (s.length - 1); mask++) {
    const pieces: string[] = [];
    let start = 0;
    for (let i = 1; i <= s.length; i++) {
      if (i === s.length || mask & (1 << (i - 1))) {
        pieces.push(s.slice(start, i));
        start = i;
      }
    }
    if (pieces.every(isMirror)) out.push(pieces);
  }
  return out;
}

const gridOf = (rows: string[]) => rows.map((r) => r.split(""));
const allA = gridOf(["AAAAA", "AAAAA", "AAAAA", "AAAAA", "AAAAA"]);

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
  {
    slug: "every-ordering",
    title: "Every Ordering",
    pattern: "backtracking",
    difficulty: "medium",
    rating: 1200,
    statement: `Given an array \`nums\` of distinct integers, return every possible arrangement of all its elements. Each arrangement uses every element exactly once.

You may return the arrangements in any order.`,
    constraints: ["1 <= nums.length <= 6", "-10 <= nums[i] <= 10", "All values in nums are distinct."],
    hints: [
      "Build an arrangement one position at a time. What choices do you have for the next position?",
      "Backtrack: keep the current partial arrangement and a used[] flag per element. Try each unused element, recurse, then undo the choice. Record the arrangement when it has n elements.",
      "out, cur, used = [], [], [False] * n\ndef go():\n    if len(cur) == n: out.append(cur[:]); return\n    for i in range(n):\n        if not used[i]:\n            used[i] = True; cur.append(nums[i])\n            go()\n            cur.pop(); used[i] = False\ngo(); return out",
    ],
    complexity: { time: "O(n! · n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "permute",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int[][]",
      compare: "unordered",
    },
    tests: [
      { input: [[1, 2, 3]], expected: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]], sample: true },
      { input: [[0, 1]], expected: [[0, 1], [1, 0]], sample: true },
      { input: [[1]], expected: [[1]], label: "single element" },
      { input: [[-1, 5]], expected: [[-1, 5], [5, -1]], label: "negative value" },
      { input: [[0, -10, 10]], expected: allOrderings([0, -10, 10]), label: "extremes" },
      { input: [[7, 8, 9, 10]], expected: allOrderings([7, 8, 9, 10]), label: "four elements" },
      { input: [[5, 4, 3, 2, 1]], expected: allOrderings([5, 4, 3, 2, 1]), label: "five elements" },
      { input: [[-3, 1, 4, -1, 5, 9]], expected: allOrderings([-3, 1, 4, -1, 5, 9]), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Microsoft", "LinkedIn", "Bloomberg"],
    source: { name: "LeetCode 46. Permutations", url: "https://leetcode.com/problems/permutations/" },
    reference: `function permute(nums) {
  const out = [], cur = [], used = new Array(nums.length).fill(false);
  function go() {
    if (cur.length === nums.length) { out.push(cur.slice()); return; }
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(nums[i]);
      go();
      cur.pop();
      used[i] = false;
    }
  }
  go();
  return out;
}`,
  },
  {
    slug: "collections-from-repeated-items",
    title: "Collections From Repeated Items",
    pattern: "backtracking",
    difficulty: "medium",
    rating: 1300,
    statement: `You get an array \`nums\` of integers that may contain repeats. Return every distinct sub-collection you can form by picking some (possibly none) of its elements.

Two sub-collections are the same if they contain the same values with the same counts, regardless of order, so \`[1, 2]\` and \`[2, 1]\` count once. Return the sub-collections in any order, with the values inside each in any order.`,
    constraints: ["1 <= nums.length <= 10", "-10 <= nums[i] <= 10"],
    hints: [
      "Duplicates come from choosing equal values at the same step of the search. Sorting first puts equal values next to each other.",
      "Sort, then backtrack from a start index: record the current pick, and for each i from start, skip nums[i] if i > start and nums[i] == nums[i - 1]. Otherwise take it and recurse from i + 1.",
      "nums.sort(); out, cur = [], []\ndef go(start):\n    out.append(cur[:])\n    for i in range(start, len(nums)):\n        if i > start and nums[i] == nums[i - 1]: continue\n        cur.append(nums[i]); go(i + 1); cur.pop()\ngo(0); return out",
    ],
    complexity: { time: "O(2^n · n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "subsetsWithDup",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int[][]",
      compare: "unordered-nested",
    },
    tests: [
      { input: [[1, 2, 2]], expected: [[], [1], [1, 2], [1, 2, 2], [2], [2, 2]], sample: true },
      { input: [[0]], expected: [[], [0]], sample: true },
      { input: [[1, 1]], expected: [[], [1], [1, 1]], label: "all duplicates" },
      { input: [[3, 2, 1]], expected: distinctSubsets([3, 2, 1]), label: "no duplicates, unsorted" },
      { input: [[4, 4, 4, 1, 4]], expected: distinctSubsets([4, 4, 4, 1, 4]), label: "many repeats" },
      { input: [[-1, 1, -1]], expected: distinctSubsets([-1, 1, -1]), label: "negative repeats" },
      { input: [[5, 5, 5, 5, 5, 5]], expected: distinctSubsets([5, 5, 5, 5, 5, 5]), label: "single value" },
      { input: [[2, 1, 2, 1, 3, 3]], expected: distinctSubsets([2, 1, 2, 1, 3, 3]), label: "pairs of repeats" },
      { input: [[1, 2, 3, 3, 2, 1, 4, 0, 4, 5]], expected: distinctSubsets([1, 2, 3, 3, 2, 1, 4, 0, 4, 5]), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Bloomberg", "Microsoft"],
    source: { name: "LeetCode 90. Subsets II", url: "https://leetcode.com/problems/subsets-ii/" },
    reference: `function subsetsWithDup(nums) {
  const a = nums.slice().sort((x, y) => x - y);
  const out = [], cur = [];
  function go(start) {
    out.push(cur.slice());
    for (let i = start; i < a.length; i++) {
      if (i > start && a[i] === a[i - 1]) continue;
      cur.push(a[i]);
      go(i + 1);
      cur.pop();
    }
  }
  go(0);
  return out;
}`,
  },
  {
    slug: "single-use-coin-totals",
    title: "Single-Use Coin Totals",
    pattern: "backtracking",
    difficulty: "medium",
    rating: 1420,
    statement: `You have a pile of coins with values \`candidates\` (values may repeat) and a \`target\`. Each coin in the pile can be used at most once.

Return every distinct combination of coins whose values add up to \`target\`. Combinations are compared by their values with counts, so two combinations that use different coins of the same values count once. Return them in any order, with the values inside each in any order.`,
    constraints: ["1 <= candidates.length <= 16", "1 <= candidates[i] <= 50", "1 <= target <= 30"],
    hints: [
      "This is like listing sums with unlimited coins, except each coin can be used once and equal coins must not produce repeated answers.",
      "Sort the coins. Backtrack from a start index with the remaining amount; move to i + 1 after taking coin i, skip coin i when it equals coin i - 1 at the same level, and stop the loop once a coin exceeds what remains.",
      "cands.sort(); out, cur = [], []\ndef go(start, left):\n    if left == 0: out.append(cur[:]); return\n    for i in range(start, len(cands)):\n        if i > start and cands[i] == cands[i - 1]: continue\n        if cands[i] > left: break\n        cur.append(cands[i]); go(i + 1, left - cands[i]); cur.pop()\ngo(0, target); return out",
    ],
    complexity: { time: "O(2^n · n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "combinationSum2",
      params: [
        { name: "candidates", type: "int[]" },
        { name: "target", type: "int" },
      ],
      returns: "int[][]",
      compare: "unordered-nested",
    },
    tests: [
      { input: [[10, 1, 2, 7, 6, 1, 5], 8], expected: [[1, 1, 6], [1, 2, 5], [1, 7], [2, 6]], sample: true },
      { input: [[2, 5, 2, 1, 2], 5], expected: [[1, 2, 2], [5]], sample: true },
      { input: [[3], 3], expected: [[3]], label: "single coin" },
      { input: [[4, 5], 3], expected: [], label: "every coin too big" },
      { input: [[2, 4, 6], 5], expected: [], label: "no combination" },
      { input: [[1, 1, 1, 1], 2], expected: [[1, 1]], label: "duplicates collapse" },
      { input: [[1, 2, 3, 4, 5], 15], expected: [[1, 2, 3, 4, 5]], label: "uses every coin" },
      { input: [[3, 1, 3, 5, 1, 1], 8], expected: singleUseTotals([3, 1, 3, 5, 1, 1], 8), label: "mixed repeats" },
      {
        input: [[1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 7, 8, 9, 10, 1, 2], 20],
        expected: singleUseTotals([1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 7, 8, 9, 10, 1, 2], 20),
        label: "large input",
      },
    ],
    companies: ["Amazon", "Meta", "Microsoft", "Apple"],
    source: { name: "LeetCode 40. Combination Sum II", url: "https://leetcode.com/problems/combination-sum-ii/" },
    reference: `function combinationSum2(candidates, target) {
  const a = candidates.slice().sort((x, y) => x - y);
  const out = [], cur = [];
  function go(start, left) {
    if (left === 0) { out.push(cur.slice()); return; }
    for (let i = start; i < a.length; i++) {
      if (i > start && a[i] === a[i - 1]) continue;
      if (a[i] > left) break;
      cur.push(a[i]);
      go(i + 1, left - a[i]);
      cur.pop();
    }
  }
  go(0, target);
  return out;
}`,
  },
  {
    slug: "trace-a-word-in-a-letter-grid",
    title: "Trace a Word in a Letter Grid",
    pattern: "backtracking",
    difficulty: "medium",
    rating: 1500,
    statement: `You get a grid of letters \`board\` and a string \`word\`. You can trace a word by starting on any cell and repeatedly stepping to a cell that shares a side with the current one (up, down, left or right), reading one letter per cell. A single trace may not visit the same cell twice.

Return \`true\` if some trace spells \`word\`, and \`false\` otherwise.`,
    constraints: [
      "1 <= board.length, board[i].length <= 6",
      "1 <= word.length <= 15",
      "board and word consist of English letters (case matters).",
    ],
    hints: [
      "Every trace starts somewhere. For each cell that matches the first letter, can you search outward from it?",
      "DFS from (r, c) with index i: fail if out of bounds, already used, or board[r][c] != word[i]. Mark the cell used, try the four neighbors with i + 1, then unmark it before returning.",
      "def dfs(r, c, i):\n    if i == len(word): return True\n    if not (0 <= r < R and 0 <= c < C) or board[r][c] != word[i]: return False\n    ch, board[r][c] = board[r][c], '#'\n    found = any(dfs(r + dr, c + dc, i + 1) for dr, dc in DIRS)\n    board[r][c] = ch\n    return found\nreturn any(dfs(r, c, 0) for r in range(R) for c in range(C))",
    ],
    complexity: { time: "O(m·n·3^L)", space: "O(L)" },
    signature: {
      kind: "function",
      name: "exist",
      params: [
        { name: "board", type: "string[][]" },
        { name: "word", type: "string" },
      ],
      returns: "bool",
    },
    tests: [
      { input: [gridOf(["ABCE", "SFCS", "ADEE"]), "ABCCED"], expected: true, sample: true },
      { input: [gridOf(["ABCE", "SFCS", "ADEE"]), "ABCB"], expected: false, sample: true },
      { input: [gridOf(["ABCE", "SFCS", "ADEE"]), "SEE"], expected: true, label: "starts mid-grid" },
      { input: [gridOf(["a"]), "a"], expected: true, label: "single cell" },
      { input: [gridOf(["a"]), "ab"], expected: false, label: "word longer than grid" },
      { input: [gridOf(["ab", "cd"]), "acdb"], expected: true, label: "turns corners" },
      { input: [gridOf(["ab", "cd"]), "ad"], expected: false, label: "no diagonal steps" },
      { input: [gridOf(["aa"]), "aaa"], expected: false, label: "cannot reuse a cell" },
      { input: [gridOf(["Ab"]), "ab"], expected: false, label: "case matters" },
      { input: [allA, "AAAAAAAAAB"], expected: false, label: "large input, missing last letter" },
      { input: [allA, "A".repeat(15)], expected: true, label: "large input, long snake" },
    ],
    companies: ["Amazon", "Meta", "Microsoft", "Bloomberg", "Uber"],
    source: { name: "LeetCode 79. Word Search", url: "https://leetcode.com/problems/word-search/" },
    reference: `function exist(board, word) {
  const R = board.length, C = board[0].length;
  function dfs(r, c, i) {
    if (i === word.length) return true;
    if (r < 0 || c < 0 || r >= R || c >= C || board[r][c] !== word[i]) return false;
    const ch = board[r][c];
    board[r][c] = "#";
    const found = dfs(r + 1, c, i + 1) || dfs(r - 1, c, i + 1) || dfs(r, c + 1, i + 1) || dfs(r, c - 1, i + 1);
    board[r][c] = ch;
    return found;
  }
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (dfs(r, c, 0)) return true;
  return false;
}`,
  },
  {
    slug: "mirror-piece-splits",
    title: "Mirror-Piece Splits",
    pattern: "backtracking",
    difficulty: "medium",
    rating: 1600,
    statement: `Given a string \`s\`, cut it into one or more consecutive pieces so that every piece reads the same forwards and backwards.

Return every way to do this. Each way is the list of pieces in order from left to right (so the pieces always join back into \`s\`). You may return the ways in any order.`,
    constraints: ["1 <= s.length <= 12", "s consists of lowercase English letters."],
    hints: [
      "Decide the first piece, then the rest of the string is the same problem again.",
      "Backtrack from a start index: for each end from start to n - 1, if s[start..end] is a palindrome, take it as the next piece and recurse from end + 1. Record the pieces when start reaches n.",
      "out, cur = [], []\ndef go(start):\n    if start == len(s): out.append(cur[:]); return\n    for end in range(start + 1, len(s) + 1):\n        piece = s[start:end]\n        if piece == piece[::-1]:\n            cur.append(piece); go(end); cur.pop()\ngo(0); return out",
    ],
    complexity: { time: "O(2^n · n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "partition",
      params: [{ name: "s", type: "string" }],
      returns: "string[][]",
      compare: "unordered",
    },
    tests: [
      { input: ["aab"], expected: [["a", "a", "b"], ["aa", "b"]], sample: true },
      { input: ["a"], expected: [["a"]], sample: true },
      { input: ["ab"], expected: [["a", "b"]], label: "no long palindromes" },
      { input: ["aba"], expected: [["a", "b", "a"], ["aba"]], label: "whole string" },
      { input: ["abba"], expected: mirrorSplits("abba"), label: "even palindrome" },
      { input: ["racecar"], expected: mirrorSplits("racecar"), label: "nested palindromes" },
      { input: ["abcd"], expected: [["a", "b", "c", "d"]], label: "all distinct" },
      { input: ["aaaaaaaaaaaa"], expected: mirrorSplits("aaaaaaaaaaaa"), label: "large input, all same" },
      { input: ["abacabadabac"], expected: mirrorSplits("abacabadabac"), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Meta", "Bloomberg"],
    source: { name: "LeetCode 131. Palindrome Partitioning", url: "https://leetcode.com/problems/palindrome-partitioning/" },
    reference: `function partition(s) {
  const out = [], cur = [];
  const isPal = (lo, hi) => {
    while (lo < hi) if (s[lo++] !== s[hi--]) return false;
    return true;
  };
  function go(start) {
    if (start === s.length) { out.push(cur.slice()); return; }
    for (let end = start; end < s.length; end++) {
      if (!isPal(start, end)) continue;
      cur.push(s.slice(start, end + 1));
      go(end + 1);
      cur.pop();
    }
  }
  go(0);
  return out;
}`,
  },
];
