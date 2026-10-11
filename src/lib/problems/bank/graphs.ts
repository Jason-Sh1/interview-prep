import type { Problem } from "../types";

const chainEdges = (n: number) => Array.from({ length: n - 1 }, (_, i) => [i, i + 1]);
const checkerboard = (n: number) =>
  Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => ((r + c) % 2 === 0 ? "1" : "0")));

export const graphs: Problem[] = [
  {
    slug: "route-between-rooms",
    title: "Route Between Rooms",
    pattern: "graphs",
    difficulty: "easy",
    rating: 1000,
    statement: `A building has \`n\` rooms labeled \`0\` to \`n - 1\`. Each entry \`edges[i] = [a, b]\` is a hallway you can walk in either direction between rooms \`a\` and \`b\`.

Return \`true\` if you can walk from room \`source\` to room \`destination\` using the hallways, and \`false\` otherwise. A room is always reachable from itself.`,
    constraints: [
      "1 <= n <= 2 * 10^5",
      "0 <= edges.length <= 2 * 10^5",
      "0 <= a, b, source, destination < n",
      "Hallways may repeat.",
    ],
    hints: [
      "Turn the edge list into something you can ask \"who are my neighbors?\" quickly.",
      "Build an adjacency list, then BFS or DFS from source, marking rooms as visited. Stop as soon as you reach destination.",
      "adj = defaultdict(list)\nfor a, b in edges: adj[a].append(b); adj[b].append(a)\nseen = {source}; stack = [source]\nwhile stack:\n    u = stack.pop()\n    if u == destination: return True\n    for v in adj[u]:\n        if v not in seen: seen.add(v); stack.append(v)\nreturn False",
    ],
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    signature: {
      kind: "function",
      name: "validPath",
      params: [
        { name: "n", type: "int" },
        { name: "edges", type: "int[][]" },
        { name: "source", type: "int" },
        { name: "destination", type: "int" },
      ],
      returns: "bool",
    },
    tests: [
      { input: [3, [[0, 1], [1, 2], [2, 0]], 0, 2], expected: true, sample: true },
      { input: [6, [[0, 1], [0, 2], [3, 5], [5, 4], [4, 3]], 0, 5], expected: false, sample: true },
      { input: [1, [], 0, 0], expected: true, label: "single room" },
      { input: [2, [], 0, 1], expected: false, label: "no hallways" },
      { input: [3, [[0, 1]], 2, 2], expected: true, label: "isolated source equals destination" },
      { input: [4, [[0, 1], [2, 3]], 3, 2], expected: true, label: "walk edge backwards" },
      { input: [5, [[0, 4], [4, 1], [1, 3]], 0, 3], expected: true, label: "multi-step path" },
      { input: [4, [[0, 1], [1, 0], [2, 3]], 0, 3], expected: false, label: "disconnected, repeated edges" },
      { input: [2000, chainEdges(2000), 0, 1999], expected: true, label: "long chain" },
    ],
    companies: ["Amazon", "Google", "Microsoft"],
    source: {
      name: "LeetCode 1971. Find if Path Exists in Graph",
      url: "https://leetcode.com/problems/find-if-path-exists-in-graph/",
    },
    reference: `function validPath(n, edges, source, destination) {
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  const seen = new Array(n).fill(false);
  const stack = [source];
  seen[source] = true;
  while (stack.length) {
    const u = stack.pop();
    if (u === destination) return true;
    for (const v of adj[u]) if (!seen[v]) { seen[v] = true; stack.push(v); }
  }
  return false;
}`,
  },
  {
    slug: "count-land-masses",
    title: "Count the Land Masses",
    pattern: "graphs",
    difficulty: "medium",
    rating: 1280,
    statement: `You are given a map as an \`m x n\` grid of strings, where \`"1"\` is land and \`"0"\` is water.

A land mass is a group of land cells joined horizontally or vertically (diagonal neighbors do **not** connect). Everything outside the grid is water.

Return the number of separate land masses on the map.`,
    constraints: ["1 <= m, n <= 300", 'grid[i][j] is "0" or "1"'],
    hints: [
      "Each time you find land you have not seen before, you have found a new land mass. How do you avoid counting its other cells again?",
      "Scan every cell. When you hit unvisited land, increment the count and flood-fill (BFS/DFS) the whole connected piece, marking it visited (e.g. by overwriting it with \"0\").",
      "count = 0\nfor r, c in all cells:\n    if grid[r][c] == '1':\n        count += 1\n        stack = [(r, c)]; grid[r][c] = '0'\n        while stack:\n            x, y = stack.pop()\n            for nx, ny in 4 neighbors in bounds:\n                if grid[nx][ny] == '1': grid[nx][ny] = '0'; stack.append((nx, ny))\nreturn count",
    ],
    complexity: { time: "O(m·n)", space: "O(m·n)" },
    signature: {
      kind: "function",
      name: "numIslands",
      params: [{ name: "grid", type: "string[][]" }],
      returns: "int",
    },
    tests: [
      {
        input: [
          [
            ["1", "1", "0", "0"],
            ["1", "0", "0", "1"],
            ["0", "0", "1", "1"],
          ],
        ],
        expected: 2,
        sample: true,
      },
      {
        input: [
          [
            ["1", "0", "1", "0", "1"],
            ["1", "0", "0", "0", "1"],
            ["0", "1", "1", "0", "0"],
          ],
        ],
        expected: 4,
        sample: true,
      },
      { input: [[["0"]]], expected: 0, label: "single water cell" },
      { input: [[["1"]]], expected: 1, label: "single land cell" },
      {
        input: [
          [
            ["0", "0", "0"],
            ["0", "0", "0"],
          ],
        ],
        expected: 0,
        label: "all water",
      },
      {
        input: [
          [
            ["1", "1"],
            ["1", "1"],
          ],
        ],
        expected: 1,
        label: "all land",
      },
      {
        input: [
          [
            ["1", "0", "1"],
            ["0", "1", "0"],
            ["1", "0", "1"],
          ],
        ],
        expected: 5,
        label: "diagonals don't connect",
      },
      {
        input: [
          [
            ["1", "1", "1"],
            ["0", "0", "1"],
            ["1", "1", "1"],
          ],
        ],
        expected: 1,
        label: "winding shape",
      },
      { input: [checkerboard(30)], expected: 450, label: "large checkerboard" },
    ],
    companies: ["Amazon", "Google", "Meta", "Microsoft", "Bloomberg"],
    source: { name: "LeetCode 200. Number of Islands", url: "https://leetcode.com/problems/number-of-islands/" },
    reference: `function numIslands(grid) {
  const m = grid.length, n = m ? grid[0].length : 0;
  let count = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let r = 0; r < m; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] !== "1") continue;
      count++;
      grid[r][c] = "0";
      const stack = [[r, c]];
      while (stack.length) {
        const [x, y] = stack.pop();
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < m && ny < n && grid[nx][ny] === "1") {
            grid[nx][ny] = "0";
            stack.push([nx, ny]);
          }
        }
      }
    }
  }
  return count;
}`,
  },
  {
    slug: "spreading-mold",
    title: "Spreading Mold",
    pattern: "graphs",
    difficulty: "medium",
    rating: 1480,
    statement: `A pantry shelf is an \`m x n\` grid. Each cell holds:

- \`0\`: an empty spot,
- \`1\`: a fresh loaf of bread,
- \`2\`: a moldy loaf.

Every minute, each fresh loaf that shares a side (up, down, left, right) with a moldy loaf becomes moldy.

Return the minimum number of minutes until no fresh loaf remains. If some fresh loaf can never become moldy, return \`-1\`. If there are no fresh loaves at the start, the answer is \`0\`.`,
    constraints: ["1 <= m, n <= 10", "grid[i][j] is 0, 1 or 2"],
    hints: [
      "All moldy loaves spread at the same time. Which traversal naturally processes things in \"rounds\"?",
      "Multi-source BFS: put every moldy cell in the queue at minute 0, count the fresh loaves, and process the queue level by level. Each level is one minute.",
      "queue = all cells with 2; fresh = count of 1s; minutes = 0\nwhile queue and fresh:\n    for _ in range(len(queue)):\n        r, c = queue.popleft()\n        for each fresh neighbor: mark 2, fresh -= 1, queue.append(it)\n    minutes += 1\nreturn minutes if fresh == 0 else -1",
    ],
    complexity: { time: "O(m·n)", space: "O(m·n)" },
    signature: {
      kind: "function",
      name: "orangesRotting",
      params: [{ name: "grid", type: "int[][]" }],
      returns: "int",
    },
    tests: [
      {
        input: [
          [
            [2, 1, 0],
            [1, 1, 0],
            [0, 1, 1],
          ],
        ],
        expected: 4,
        sample: true,
      },
      {
        input: [
          [
            [2, 1, 0],
            [0, 0, 1],
          ],
        ],
        expected: -1,
        sample: true,
      },
      { input: [[[0, 2]]], expected: 0, label: "no fresh bread" },
      { input: [[[0]]], expected: 0, label: "empty shelf" },
      { input: [[[1]]], expected: -1, label: "fresh but no mold" },
      { input: [[[2, 1, 1, 1, 2]]], expected: 2, label: "multiple sources" },
      {
        input: [
          [
            [2, 2],
            [2, 2],
          ],
        ],
        expected: 0,
        label: "all moldy",
      },
      {
        input: [
          [
            [1, 1],
            [1, 2],
          ],
        ],
        expected: 2,
        label: "corner source",
      },
      { input: [[[2, ...Array(49).fill(1)]]], expected: 49, label: "long row" },
    ],
    companies: ["Amazon", "Microsoft", "Google", "Bloomberg"],
    source: { name: "LeetCode 994. Rotting Oranges", url: "https://leetcode.com/problems/rotting-oranges/" },
    reference: `function orangesRotting(grid) {
  const m = grid.length, n = grid[0].length;
  let queue = [], fresh = 0;
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) {
    if (grid[r][c] === 2) queue.push([r, c]);
    else if (grid[r][c] === 1) fresh++;
  }
  let minutes = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length && fresh > 0) {
    const next = [];
    for (const [r, c] of queue) {
      for (const [dr, dc] of dirs) {
        const x = r + dr, y = c + dc;
        if (x >= 0 && y >= 0 && x < m && y < n && grid[x][y] === 1) {
          grid[x][y] = 2; fresh--; next.push([x, y]);
        }
      }
    }
    queue = next;
    minutes++;
  }
  return fresh === 0 ? minutes : -1;
}`,
  },
];
