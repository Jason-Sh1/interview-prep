import type { Problem } from "../types";

const pairEdges = (n: number) => Array.from({ length: n / 2 }, (_, i) => [2 * i, 2 * i + 1]);
// A cycle through all nodes 1..n where the edge [1, n] comes first, so the
// last chain edge is the one that closes the cycle.
const bigCycle = (n: number) => [[1, n], ...Array.from({ length: n - 1 }, (_, i) => [i + 1, i + 2])];

// Brute-force helpers: plain graph searches and closures instead of union-find.
function componentsOf(n: number, edges: number[][]): number[] {
  const adj = Array.from({ length: n }, () => [] as number[]);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  const comp = new Array(n).fill(-1);
  for (let s = 0; s < n; s++) {
    if (comp[s] !== -1) continue;
    comp[s] = s;
    const stack = [s];
    while (stack.length) for (const v of adj[stack.pop()!]) if (comp[v] === -1) {
          comp[v] = s;
          stack.push(v);
        }
  }
  return comp;
}

function isTreeBrute(n: number, edges: number[][]): boolean {
  return edges.length === n - 1 && new Set(componentsOf(n, edges)).size === 1;
}

function equationsByClosure(equations: string[]): boolean {
  const same = Array.from({ length: 26 }, (_, i) => Array.from({ length: 26 }, (_, j) => i === j));
  const code = (ch: string) => ch.charCodeAt(0) - 97;
  for (const e of equations) if (e[1] === "=") same[code(e[0])][code(e[3])] = same[code(e[3])][code(e[0])] = true;
  for (let k = 0; k < 26; k++) for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) if (same[i][k] && same[k][j]) same[i][j] = true;
  return equations.every((e) => e[1] === "=" || !same[code(e[0])][code(e[3])]);
}

function stonesBrute(stones: number[][]): number {
  const edges: number[][] = [];
  for (let i = 0; i < stones.length; i++)
    for (let j = i + 1; j < stones.length; j++)
      if (stones[i][0] === stones[j][0] || stones[i][1] === stones[j][1]) edges.push([i, j]);
  return stones.length - new Set(componentsOf(stones.length, edges)).size;
}

function swapsBrute(s: string, pairs: number[][]): string {
  const comp = componentsOf(s.length, pairs);
  const groups = new Map<number, number[]>();
  comp.forEach((c, i) => groups.set(c, [...(groups.get(c) ?? []), i]));
  const out = s.split("");
  for (const idx of groups.values()) {
    const letters = idx.map((i) => s[i]).sort();
    idx.forEach((i, k) => (out[i] = letters[k]));
  }
  return out.join("");
}

function islandsByRecounting(m: number, n: number, positions: number[][]): number[] {
  const land = Array.from({ length: m }, () => new Array(n).fill(false));
  return positions.map(([r, c]) => {
    land[r][c] = true;
    const seen = land.map((row) => row.map(() => false));
    let count = 0;
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++) {
        if (!land[i][j] || seen[i][j]) continue;
        count++;
        const stack = [[i, j]];
        seen[i][j] = true;
        while (stack.length) {
          const [y, x] = stack.pop()!;
          for (const [ny, nx] of [[y + 1, x], [y - 1, x], [y, x + 1], [y, x - 1]])
            if (ny >= 0 && nx >= 0 && ny < m && nx < n && land[ny][nx] && !seen[ny][nx]) {
              seen[ny][nx] = true;
              stack.push([ny, nx]);
            }
        }
      }
    return count;
  });
}

const treeEdges = (n: number) => Array.from({ length: n - 1 }, (_, i) => [Math.floor((i * 7) % (i + 1)), i + 1]);
const bigEquations = Array.from({ length: 300 }, (_, i) => {
  const a = String.fromCharCode(97 + ((i * 7) % 26));
  const b = String.fromCharCode(97 + ((i * 11 + 3) % 26));
  return a + (i % 9 === 0 ? "!=" : "==") + b;
});
const bigStones = Array.from({ length: 400 }, (_, i) => [(i * 37) % 97, (i * 53 + i * i) % 89]).filter(
  (p, i, all) => all.findIndex((q) => q[0] === p[0] && q[1] === p[1]) === i,
);
const bigSwapString = Array.from({ length: 300 }, (_, i) => String.fromCharCode(97 + ((i * 17 + 5) % 26))).join("");
const bigSwapPairs = Array.from({ length: 120 }, (_, i) => [(i * 31) % 300, (i * 47 + 13) % 300]);
const bigPositions = Array.from({ length: 200 }, (_, i) => [(i * 7 + (i >> 3)) % 20, (i * 13 + 5) % 20]);

export const unionFind: Problem[] = [
  {
    slug: "friend-circle-count",
    title: "Friend Circle Count",
    pattern: "union-find",
    difficulty: "easy",
    rating: 1150,
    statement: `There are \`n\` people labeled \`0\` to \`n - 1\`. Each pair \`edges[i] = [a, b]\` says that \`a\` and \`b\` are friends. Friendship is mutual, and friends of friends belong to the same circle.

Return the number of separate friend circles. A person with no friends forms a circle of their own.`,
    constraints: ["1 <= n <= 2000", "0 <= edges.length <= 5000", "0 <= a, b < n", "Pairs may repeat."],
    hints: [
      "Start with n circles. When does adding a friendship reduce the number of circles?",
      "Use union-find: each person starts as their own root. For each pair, find both roots; if they differ, union them and decrease the circle count by one.",
      "parent = list(range(n)); count = n\ndef find(x):\n    while parent[x] != x:\n        parent[x] = parent[parent[x]]; x = parent[x]\n    return x\nfor a, b in edges:\n    ra, rb = find(a), find(b)\n    if ra != rb: parent[ra] = rb; count -= 1\nreturn count",
    ],
    complexity: { time: "O(n + E·α(n))", space: "O(n)" },
    signature: {
      kind: "function",
      name: "countComponents",
      params: [
        { name: "n", type: "int" },
        { name: "edges", type: "int[][]" },
      ],
      returns: "int",
    },
    tests: [
      { input: [5, [[0, 1], [1, 2], [3, 4]]], expected: 2, sample: true },
      { input: [5, [[0, 1], [1, 2], [2, 3], [3, 4]]], expected: 1, sample: true },
      { input: [1, []], expected: 1, label: "single person" },
      { input: [4, []], expected: 4, label: "no friendships" },
      { input: [4, [[0, 1], [1, 2], [2, 0]]], expected: 2, label: "cycle plus loner" },
      { input: [3, [[0, 1], [0, 1], [1, 0]]], expected: 2, label: "repeated pairs" },
      { input: [6, [[5, 4], [3, 2], [1, 0]]], expected: 3, label: "disjoint pairs" },
      { input: [7, [[0, 6], [6, 3], [2, 5], [5, 0]]], expected: 3, label: "merging two groups" },
      { input: [2000, pairEdges(2000)], expected: 1000, label: "many components" },
    ],
    companies: ["Amazon", "LinkedIn", "Google", "Meta"],
    source: {
      name: "LeetCode 323. Number of Connected Components in an Undirected Graph",
      url: "https://leetcode.com/problems/number-of-connected-components-in-an-undirected-graph/",
    },
    reference: `function countComponents(n, edges) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array(n).fill(0);
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  let count = n;
  for (const [a, b] of edges) {
    let ra = find(a), rb = find(b);
    if (ra === rb) continue;
    if (rank[ra] < rank[rb]) { const t = ra; ra = rb; rb = t; }
    parent[rb] = ra;
    if (rank[ra] === rank[rb]) rank[ra]++;
    count--;
  }
  return count;
}`,
  },
  {
    slug: "extra-cable",
    title: "The Extra Cable",
    pattern: "union-find",
    difficulty: "medium",
    rating: 1380,
    statement: `A network started as a tree of \`n\` machines labeled \`1\` to \`n\` (connected, with no loops). Then one extra cable was added between two different machines that were not already directly connected, creating exactly one loop.

You are given the \`n\` cables as \`edges\`, where \`edges[i] = [a, b]\` connects machines \`a\` and \`b\` (cables work both ways).

Return a cable whose removal turns the network back into a tree. If several cables would work, return the one that appears **last** in \`edges\`. Return it exactly as it appears in the input.`,
    constraints: ["3 <= n <= 1000", "edges.length == n", "1 <= a, b <= n and a != b", "No cable appears twice."],
    hints: [
      "Add the cables one by one. Which cable is the first one that connects two machines that are already connected?",
      "Use union-find. Process the cables in order; the first cable whose two ends already share a root closes the loop, and it is also the last loop cable in the input.",
      "parent = list(range(n + 1))\nfor a, b in edges:\n    ra, rb = find(a), find(b)\n    if ra == rb: return [a, b]\n    parent[ra] = rb",
    ],
    complexity: { time: "O(n·α(n))", space: "O(n)" },
    signature: {
      kind: "function",
      name: "findRedundantConnection",
      params: [{ name: "edges", type: "int[][]" }],
      returns: "int[]",
    },
    tests: [
      { input: [[[1, 2], [1, 3], [2, 3]]], expected: [2, 3], sample: true },
      { input: [[[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]]], expected: [1, 4], sample: true },
      { input: [[[2, 3], [1, 3], [1, 2]]], expected: [1, 2], label: "smallest loop" },
      { input: [[[1, 4], [3, 4], [1, 3], [1, 2], [4, 5]]], expected: [1, 3], label: "loop before the tail" },
      { input: [[[3, 4], [1, 2], [2, 4], [3, 5], [2, 5]]], expected: [2, 5], label: "loop closed by last cable" },
      { input: [[[1, 2], [2, 3], [3, 1], [3, 4]]], expected: [3, 1], label: "keep input orientation" },
      { input: [[[4, 1], [2, 4], [1, 2], [3, 2], [5, 3], [6, 5]]], expected: [1, 2], label: "branches after loop" },
      { input: [bigCycle(500)], expected: [499, 500], label: "loop through every machine" },
    ],
    companies: ["Google", "Amazon", "Bloomberg"],
    source: {
      name: "LeetCode 684. Redundant Connection",
      url: "https://leetcode.com/problems/redundant-connection/",
    },
    reference: `function findRedundantConnection(edges) {
  const parent = Array.from({ length: edges.length + 1 }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  for (const [a, b] of edges) {
    const ra = find(a), rb = find(b);
    if (ra === rb) return [a, b];
    parent[ra] = rb;
  }
  return [];
}`,
  },
  {
    slug: "merge-user-profiles",
    title: "Merge User Profiles",
    pattern: "union-find",
    difficulty: "medium",
    rating: 1620,
    statement: `You are given a list of user profiles. Each profile is a list of strings: the first is the user's name and the rest are email addresses.

Two profiles belong to the same person if they share at least one email address, and this is transitive (if A shares an email with B and B shares one with C, all three are the same person). Two profiles with the same name are **not** necessarily the same person. Every profile of one person has the same name.

Merge the profiles and return one entry per person: the name first, followed by all of that person's distinct emails in sorted (ASCII) order. The people may be returned in any order.`,
    constraints: [
      "1 <= accounts.length <= 1000",
      "2 <= accounts[i].length <= 10",
      "Emails are lowercase and at most 30 characters.",
    ],
    hints: [
      "Think of each email as a node. Emails listed on the same profile are connected.",
      "Union every email in a profile with the profile's first email. Then group emails by their root, sort each group, and prepend the name stored for that root.",
      "for acc in accounts:\n    name, first = acc[0], acc[1]\n    for e in acc[1:]: owner[e] = name; union(e, first)\ngroups = defaultdict(list)\nfor e in owner: groups[find(e)].append(e)\nreturn [[owner[r]] + sorted(es) for r, es in groups.items()]",
    ],
    complexity: { time: "O(N log N)", space: "O(N)" },
    signature: {
      kind: "function",
      name: "accountsMerge",
      params: [{ name: "accounts", type: "string[][]" }],
      returns: "string[][]",
      compare: "unordered",
    },
    tests: [
      {
        input: [
          [
            ["Ava", "ava@x.io", "ava.work@x.io"],
            ["Ava", "ava.home@x.io", "ava@x.io"],
            ["Ben", "ben@y.io"],
          ],
        ],
        expected: [
          ["Ava", "ava.home@x.io", "ava.work@x.io", "ava@x.io"],
          ["Ben", "ben@y.io"],
        ],
        sample: true,
      },
      {
        input: [
          [
            ["Kim", "k1@m.com"],
            ["Kim", "k2@m.com"],
          ],
        ],
        expected: [
          ["Kim", "k1@m.com"],
          ["Kim", "k2@m.com"],
        ],
        sample: true,
      },
      { input: [[["Zoe", "zoe@w.com"]]], expected: [["Zoe", "zoe@w.com"]], label: "single profile" },
      {
        input: [[["Lee", "b@z.com", "a@z.com", "b@z.com"]]],
        expected: [["Lee", "a@z.com", "b@z.com"]],
        label: "duplicate email within profile",
      },
      {
        input: [
          [
            ["Max", "m@a.com"],
            ["Max", "m@a.com"],
          ],
        ],
        expected: [["Max", "m@a.com"]],
        label: "identical profiles",
      },
      {
        input: [
          [
            ["Sam", "a@q.com", "b@q.com"],
            ["Sam", "c@q.com", "d@q.com"],
            ["Sam", "b@q.com", "c@q.com"],
          ],
        ],
        expected: [["Sam", "a@q.com", "b@q.com", "c@q.com", "d@q.com"]],
        label: "transitive merge",
      },
      {
        input: [
          [
            ["Al", "x@e.com", "y@e.com"],
            ["Bo", "p@e.com"],
            ["Al", "z@e.com"],
            ["Bo", "q@e.com", "p@e.com"],
            ["Al", "y@e.com", "w@e.com"],
          ],
        ],
        expected: [
          ["Al", "w@e.com", "x@e.com", "y@e.com"],
          ["Al", "z@e.com"],
          ["Bo", "p@e.com", "q@e.com"],
        ],
        label: "mixed people",
      },
    ],
    companies: ["Meta", "Google", "Amazon", "Microsoft"],
    source: { name: "LeetCode 721. Accounts Merge", url: "https://leetcode.com/problems/accounts-merge/" },
    reference: `function accountsMerge(accounts) {
  const parent = new Map();
  const owner = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
    return x;
  };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const acc of accounts) {
    const name = acc[0];
    for (let i = 1; i < acc.length; i++) {
      if (!parent.has(acc[i])) parent.set(acc[i], acc[i]);
      owner.set(acc[i], name);
      union(acc[i], acc[1]);
    }
  }
  const groups = new Map();
  for (const e of parent.keys()) {
    const r = find(e);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(e);
  }
  const out = [];
  for (const [r, es] of groups) {
    es.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    out.push([owner.get(r)].concat(es));
  }
  return out;
}`,
  },
  {
    slug: "is-it-a-tree",
    title: "Is It a Tree?",
    pattern: "union-find",
    difficulty: "medium",
    rating: 1220,
    statement: `You have \`n\` nodes labeled \`0\` to \`n - 1\` and a list of undirected edges \`edges\`, where \`edges[i] = [a, b]\` connects \`a\` and \`b\`.

Return \`true\` if these edges form a single tree over all \`n\` nodes (every node is connected and there are no cycles), and \`false\` otherwise.`,
    constraints: [
      "1 <= n <= 2000",
      "0 <= edges.length <= 5000",
      "0 <= a, b < n, a != b",
      "There are no repeated edges.",
    ],
    hints: [
      "A tree on n nodes has a very specific number of edges. Is that enough on its own?",
      "Check that there are exactly n - 1 edges, then make sure no edge closes a cycle: with union-find, if both ends of an edge already share a root, the answer is false.",
      "if len(edges) != n - 1: return False\nparent = list(range(n))\ndef find(x):\n    while parent[x] != x:\n        parent[x] = parent[parent[x]]; x = parent[x]\n    return x\nfor a, b in edges:\n    ra, rb = find(a), find(b)\n    if ra == rb: return False\n    parent[ra] = rb\nreturn True",
    ],
    complexity: { time: "O(n·α(n))", space: "O(n)" },
    signature: {
      kind: "function",
      name: "validTree",
      params: [
        { name: "n", type: "int" },
        { name: "edges", type: "int[][]" },
      ],
      returns: "bool",
    },
    tests: [
      { input: [5, [[0, 1], [0, 2], [0, 3], [1, 4]]], expected: true, sample: true },
      { input: [5, [[0, 1], [1, 2], [2, 3], [1, 3], [1, 4]]], expected: false, sample: true },
      { input: [1, []], expected: true, label: "single node" },
      { input: [2, []], expected: false, label: "two nodes, no edge" },
      { input: [3, [[0, 1], [1, 2], [2, 0]]], expected: false, label: "triangle" },
      { input: [4, [[0, 1], [2, 3]]], expected: false, label: "two pieces" },
      { input: [4, [[0, 1], [1, 2], [2, 0]]], expected: false, label: "right count is not enough" },
      { input: [4, [[3, 2], [2, 1], [1, 0]]], expected: true, label: "path" },
      { input: [2000, treeEdges(2000)], expected: isTreeBrute(2000, treeEdges(2000)), label: "large input" },
      {
        input: [2000, [...treeEdges(1999), [5, 17]]],
        expected: isTreeBrute(2000, [...treeEdges(1999), [5, 17]]),
        label: "large input, hidden cycle",
      },
    ],
    companies: ["Google", "LinkedIn", "Meta", "Amazon"],
    source: { name: "LeetCode 261. Graph Valid Tree", url: "https://leetcode.com/problems/graph-valid-tree/" },
    reference: `function validTree(n, edges) {
  if (edges.length !== n - 1) return false;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const [a, b] of edges) {
    const ra = find(a), rb = find(b);
    if (ra === rb) return false;
    parent[ra] = rb;
  }
  return true;
}`,
  },
  {
    slug: "consistent-letter-equations",
    title: "Consistent Letter Equations",
    pattern: "union-find",
    difficulty: "medium",
    rating: 1300,
    statement: `Each string in \`equations\` has length 4 and looks like \`"a==b"\` or \`"a!=b"\`, where the two letters are lowercase variable names (they may be the same letter).

Return \`true\` if you can give every variable an integer value so that all the equations hold at once, and \`false\` otherwise.`,
    constraints: [
      "1 <= equations.length <= 500",
      "equations[i].length == 4",
      "equations[i][0] and equations[i][3] are lowercase letters; equations[i][1..2] is \"==\" or \"!=\".",
    ],
    hints: [
      "Equalities chain together: if a == b and b == c then a == c. Process them before the inequalities.",
      "Union the two letters of every == equation. Then check each != equation: if both letters have the same root, the equations contradict each other.",
      "parent = list(range(26))\nfor e in equations:\n    if e[1] == '=': union(e[0], e[3])\nfor e in equations:\n    if e[1] == '!' and find(e[0]) == find(e[3]): return False\nreturn True",
    ],
    complexity: { time: "O(n·α(26))", space: "O(1)" },
    signature: {
      kind: "function",
      name: "equationsPossible",
      params: [{ name: "equations", type: "string[]" }],
      returns: "bool",
    },
    tests: [
      { input: [["a==b", "b!=a"]], expected: false, sample: true },
      { input: [["b==a", "a==b"]], expected: true, sample: true },
      { input: [["a!=a"]], expected: false, label: "letter unequal to itself" },
      { input: [["a==a"]], expected: true, label: "trivial equality" },
      { input: [["a==b", "b==c", "a!=c"]], expected: false, label: "chain contradiction" },
      { input: [["a!=b", "b!=c", "c!=a"]], expected: true, label: "only inequalities" },
      { input: [["c==c", "b==d", "x!=z"]], expected: true, label: "unrelated letters" },
      { input: [["a!=c", "a==b", "b==c"]], expected: false, label: "inequality listed first" },
      { input: [bigEquations], expected: equationsByClosure(bigEquations), label: "large input" },
      {
        input: [bigEquations.filter((e) => e[1] === "=")],
        expected: equationsByClosure(bigEquations.filter((e) => e[1] === "=")),
        label: "large input, equalities only",
      },
    ],
    companies: ["Google", "Amazon", "Meta"],
    source: {
      name: "LeetCode 990. Satisfiability of Equality Equations",
      url: "https://leetcode.com/problems/satisfiability-of-equality-equations/",
    },
    reference: `function equationsPossible(equations) {
  const parent = Array.from({ length: 26 }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const code = (ch) => ch.charCodeAt(0) - 97;
  for (const e of equations) if (e[1] === "=") parent[find(code(e[0]))] = find(code(e[3]));
  for (const e of equations) if (e[1] === "!" && find(code(e[0])) === find(code(e[3]))) return false;
  return true;
}`,
  },
  {
    slug: "clear-stones-sharing-a-line",
    title: "Clear Stones Sharing a Line",
    pattern: "union-find",
    difficulty: "medium",
    rating: 1480,
    statement: `Stones sit at distinct integer points \`stones[i] = [x, y]\` on a plane. You may remove a stone if at least one other stone that has not been removed yet shares its row (same \`x\`) or its column (same \`y\`).

Return the largest number of stones you can remove, choosing the removal order well.`,
    constraints: ["1 <= stones.length <= 1000", "0 <= x, y <= 10^4", "No two stones share the same point."],
    hints: [
      "Link two stones if they share a row or column. Within one linked group, how many stones can you remove?",
      "Every connected group can be removed down to a single stone (remove leaves of a spanning tree first), so the answer is stones - number of groups. Count groups with union-find, joining each stone to its row and its column (offset the column ids so they don't collide with rows).",
      "parent = {}\ndef find(x):\n    parent.setdefault(x, x)\n    while parent[x] != x:\n        parent[x] = parent[parent[x]]; x = parent[x]\n    return x\nfor x, y in stones:\n    parent[find(x)] = find(y + 10001)\ngroups = len({find(x) for x, _ in stones})\nreturn len(stones) - groups",
    ],
    complexity: { time: "O(n·α(n))", space: "O(n)" },
    signature: {
      kind: "function",
      name: "removeStones",
      params: [{ name: "stones", type: "int[][]" }],
      returns: "int",
    },
    tests: [
      { input: [[[0, 0], [0, 1], [1, 0], [1, 2], [2, 1], [2, 2]]], expected: 5, sample: true },
      { input: [[[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]]], expected: 3, sample: true },
      { input: [[[0, 0]]], expected: 0, label: "single stone" },
      { input: [[[0, 0], [1, 1], [2, 2]]], expected: 0, label: "no shared lines" },
      { input: [[[3, 1], [3, 7], [3, 9]]], expected: 2, label: "one row" },
      { input: [[[0, 1], [1, 0], [1, 1]]], expected: 2, label: "connected through a corner" },
      { input: [[[0, 0], [0, 10000], [10000, 10000], [5, 5]]], expected: 2, label: "far apart coordinates" },
      { input: [[[1, 2], [2, 1], [3, 4], [4, 3], [1, 4]]], expected: stonesBrute([[1, 2], [2, 1], [3, 4], [4, 3], [1, 4]]), label: "two groups" },
      { input: [bigStones], expected: stonesBrute(bigStones), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Meta", "Microsoft"],
    source: {
      name: "LeetCode 947. Most Stones Removed with Same Row or Column",
      url: "https://leetcode.com/problems/most-stones-removed-with-same-row-or-column/",
    },
    reference: `function removeStones(stones) {
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
    return x;
  };
  for (const [x, y] of stones) parent.set(find(x), find(y + 10001));
  const roots = new Set(stones.map(([x]) => find(x)));
  return stones.length - roots.size;
}`,
  },
  {
    slug: "smallest-string-from-free-swaps",
    title: "Smallest String From Free Swaps",
    pattern: "union-find",
    difficulty: "medium",
    rating: 1560,
    statement: `You get a string \`s\` and a list of index pairs \`pairs\`, where \`pairs[i] = [a, b]\` means you may swap the characters at positions \`a\` and \`b\`. You can use any pair any number of times, in any order.

Return the alphabetically smallest string you can reach.`,
    constraints: [
      "1 <= s.length <= 10^5",
      "0 <= pairs.length <= 10^5",
      "0 <= a, b < s.length",
      "s consists of lowercase English letters.",
    ],
    hints: [
      "If you can swap 0↔1 and 1↔2, you can arrange the letters at positions 0, 1, 2 in any order. What does that say about connected positions?",
      "Union the two indices of each pair. Within each group, collect the letters, sort them, and write them back into the group's positions in increasing index order.",
      "for a, b in pairs: union(a, b)\ngroups = defaultdict(list)\nfor i in range(len(s)): groups[find(i)].append(i)\nout = list(s)\nfor idx in groups.values():\n    letters = sorted(s[i] for i in idx)\n    for i, ch in zip(idx, letters): out[i] = ch   # idx is already increasing\nreturn ''.join(out)",
    ],
    complexity: { time: "O(n log n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "smallestStringWithSwaps",
      params: [
        { name: "s", type: "string" },
        { name: "pairs", type: "int[][]" },
      ],
      returns: "string",
    },
    tests: [
      { input: ["dcab", [[0, 3], [1, 2]]], expected: "bacd", sample: true },
      { input: ["dcab", [[0, 3], [1, 2], [0, 2]]], expected: "abcd", sample: true },
      { input: ["cba", [[0, 1], [1, 2]]], expected: "abc", label: "chain sorts everything" },
      { input: ["zyx", []], expected: "zyx", label: "no pairs" },
      { input: ["a", []], expected: "a", label: "single letter" },
      { input: ["ba", [[0, 1], [1, 0], [0, 1]]], expected: "ab", label: "repeated pairs" },
      { input: ["dcba", [[1, 1], [0, 3]]], expected: "acbd", label: "self pair" },
      { input: ["udyyek", [[3, 3], [3, 0], [5, 1], [3, 1], [3, 4], [3, 5]]], expected: swapsBrute("udyyek", [[3, 3], [3, 0], [5, 1], [3, 1], [3, 4], [3, 5]]), label: "hub index" },
      { input: [bigSwapString, bigSwapPairs], expected: swapsBrute(bigSwapString, bigSwapPairs), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Meta"],
    source: {
      name: "LeetCode 1202. Smallest String With Swaps",
      url: "https://leetcode.com/problems/smallest-string-with-swaps/",
    },
    reference: `function smallestStringWithSwaps(s, pairs) {
  const n = s.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const [a, b] of pairs) parent[find(a)] = find(b);
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }
  const out = s.split("");
  for (const idx of groups.values()) {
    const letters = idx.map((i) => s[i]).sort();
    idx.forEach((i, k) => { out[i] = letters[k]; });
  }
  return out.join("");
}`,
  },
  {
    slug: "counting-islands-as-land-appears",
    title: "Counting Islands as Land Appears",
    pattern: "union-find",
    difficulty: "hard",
    rating: 1750,
    statement: `A grid with \`m\` rows and \`n\` columns starts as all water. The list \`positions\` describes land being added one cell at a time: \`positions[i] = [r, c]\` turns cell \`(r, c)\` into land (if it is already land, nothing changes).

An island is a group of land cells connected through up, down, left and right steps. Return an array whose \`i\`-th value is the number of islands right after the \`i\`-th addition.`,
    constraints: ["1 <= m, n <= 10^4", "1 <= m * n <= 10^4", "1 <= positions.length <= 10^4", "0 <= r < m, 0 <= c < n"],
    hints: [
      "Recounting islands after every addition costs O(m·n) each time. How does one new land cell change the count?",
      "A new cell adds one island, then merges with each neighboring land cell's island: every successful union of two different roots lowers the count by one. Skip cells that are already land.",
      "parent = {}; count = 0; out = []\nfor r, c in positions:\n    k = r * n + c\n    if k not in parent:\n        parent[k] = k; count += 1\n        for nr, nc in neighbors(r, c):\n            nk = nr * n + nc\n            if nk in parent and find(nk) != find(k):\n                union(nk, k); count -= 1\n    out.append(count)\nreturn out",
    ],
    complexity: { time: "O(m·n + k·α(m·n))", space: "O(m·n)" },
    signature: {
      kind: "function",
      name: "numIslands2",
      params: [
        { name: "m", type: "int" },
        { name: "n", type: "int" },
        { name: "positions", type: "int[][]" },
      ],
      returns: "int[]",
    },
    tests: [
      { input: [3, 3, [[0, 0], [0, 1], [1, 2], [2, 1]]], expected: [1, 1, 2, 3], sample: true },
      { input: [1, 1, [[0, 0]]], expected: [1], sample: true },
      { input: [2, 2, [[0, 0], [1, 1], [0, 1]]], expected: [1, 2, 1], label: "bridge merges two islands" },
      { input: [1, 3, [[0, 0], [0, 0], [0, 2]]], expected: [1, 1, 2], label: "repeated position" },
      { input: [3, 3, [[0, 1], [1, 0], [1, 2], [2, 1], [1, 1]]], expected: [1, 2, 3, 4, 1], label: "center joins four" },
      { input: [2, 2, [[0, 0], [1, 1]]], expected: [1, 2], label: "diagonals stay apart" },
      { input: [1, 5, [[0, 0], [0, 2], [0, 4], [0, 1], [0, 3]]], expected: [1, 2, 3, 2, 1], label: "single row" },
      {
        input: [4, 4, [[0, 0], [3, 3], [1, 1], [2, 2], [0, 1], [2, 3], [1, 2]]],
        expected: islandsByRecounting(4, 4, [[0, 0], [3, 3], [1, 1], [2, 2], [0, 1], [2, 3], [1, 2]]),
        label: "staircase",
      },
      { input: [20, 20, bigPositions], expected: islandsByRecounting(20, 20, bigPositions), label: "large input" },
    ],
    companies: ["Google", "Uber", "Amazon", "Meta"],
    source: { name: "LeetCode 305. Number of Islands II", url: "https://leetcode.com/problems/number-of-islands-ii/" },
    reference: `function numIslands2(m, n, positions) {
  const parent = new Array(m * n).fill(-1);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  let count = 0;
  const out = [];
  for (const [r, c] of positions) {
    const k = r * n + c;
    if (parent[k] === -1) {
      parent[k] = k;
      count++;
      for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
        if (nr < 0 || nc < 0 || nr >= m || nc >= n) continue;
        const nk = nr * n + nc;
        if (parent[nk] === -1) continue;
        const a = find(nk), b = find(k);
        if (a !== b) { parent[a] = b; count--; }
      }
    }
    out.push(count);
  }
  return out;
}`,
  },
];
