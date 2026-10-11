import type { Problem } from "../types";

const pairEdges = (n: number) => Array.from({ length: n / 2 }, (_, i) => [2 * i, 2 * i + 1]);
// A cycle through all nodes 1..n where the edge [1, n] comes first, so the
// last chain edge is the one that closes the cycle.
const bigCycle = (n: number) => [[1, n], ...Array.from({ length: n - 1 }, (_, i) => [i + 1, i + 2])];

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
];
