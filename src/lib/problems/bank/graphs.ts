import type { Problem } from "../types";

const chainEdges = (n: number) => Array.from({ length: n - 1 }, (_, i) => [i, i + 1]);
const checkerboard = (n: number) =>
  Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => ((r + c) % 2 === 0 ? "1" : "0")));

// Brute-force helpers: repeated sweeps until nothing changes, instead of a single BFS/DFS.
const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function repaintBySweeps(image: number[][], sr: number, sc: number, color: number): number[][] {
  const R = image.length, C = image[0].length, old = image[sr][sc];
  const hit = image.map((row) => row.map(() => false));
  hit[sr][sc] = true;
  for (let changed = true; changed; ) {
    changed = false;
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++)
        if (!hit[r][c] && image[r][c] === old)
          for (const [dr, dc] of DIRS4)
            if (hit[r + dr]?.[c + dc]) {
              hit[r][c] = true;
              changed = true;
            }
  }
  return image.map((row, r) => row.map((v, c) => (hit[r][c] ? color : v)));
}

function largestIslandBySweeps(grid: number[][]): number {
  const R = grid.length, C = grid[0].length;
  const label = grid.map((row, r) => row.map((v, c) => (v ? r * C + c + 1 : 0)));
  for (let changed = true; changed; ) {
    changed = false;
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++)
        if (label[r][c])
          for (const [dr, dc] of DIRS4) {
            const n = label[r + dr]?.[c + dc];
            if (n && n < label[r][c]) {
              label[r][c] = n;
              changed = true;
            }
          }
  }
  const size = new Map<number, number>();
  for (const row of label) for (const v of row) if (v) size.set(v, (size.get(v) ?? 0) + 1);
  return Math.max(0, ...size.values());
}

function captureBySweeps(board: string[][]): string[][] {
  const R = board.length, C = board[0].length;
  const safe = board.map((row, r) => row.map((v, c) => v === "O" && (r === 0 || c === 0 || r === R - 1 || c === C - 1)));
  for (let changed = true; changed; ) {
    changed = false;
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++)
        if (!safe[r][c] && board[r][c] === "O")
          for (const [dr, dc] of DIRS4)
            if (safe[r + dr]?.[c + dc]) {
              safe[r][c] = true;
              changed = true;
            }
  }
  return board.map((row, r) => row.map((v, c) => (v === "O" && !safe[r][c] ? "X" : v)));
}

function bothCoastsBrute(h: number[][]): number[][] {
  const R = h.length, C = h[0].length;
  const out: number[][] = [];
  for (let r0 = 0; r0 < R; r0++)
    for (let c0 = 0; c0 < C; c0++) {
      let west = false, east = false;
      const seen = new Set([r0 * C + c0]);
      const stack = [[r0, c0]];
      while (stack.length) {
        const [r, c] = stack.pop()!;
        if (r === 0 || c === 0) west = true;
        if (r === R - 1 || c === C - 1) east = true;
        for (const [dr, dc] of DIRS4) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= R || nc >= C || seen.has(nr * C + nc) || h[nr][nc] > h[r][c]) continue;
          seen.add(nr * C + nc);
          stack.push([nr, nc]);
        }
      }
      if (west && east) out.push([r0, c0]);
    }
  return out;
}

function stepChainBrute(begin: string, end: string, words: string[]): number {
  const oneApart = (a: string, b: string) => [...a].filter((ch, i) => ch !== b[i]).length === 1;
  const dist = new Map([[begin, 1]]);
  const queue = [begin];
  while (queue.length) {
    const w = queue.shift()!;
    if (w === end) return dist.get(w)!;
    for (const v of words)
      if (!dist.has(v) && oneApart(w, v)) {
        dist.set(v, dist.get(w)! + 1);
        queue.push(v);
      }
  }
  return 0;
}

const bigImage = Array.from({ length: 50 }, (_, r) => Array.from({ length: 50 }, (_, c) => ((r * 7 + c * 3) % 5 < 3 ? 1 : 0)));
const bigIslands = Array.from({ length: 40 }, (_, r) => Array.from({ length: 40 }, (_, c) => ((r * r + c * 3) % 11 < 6 ? 1 : 0)));
const bigBoard = Array.from({ length: 30 }, (_, r) => Array.from({ length: 30 }, (_, c) => ((r * 13 + c * 7) % 5 < 2 ? "O" : "X")));
const bigHeights = Array.from({ length: 25 }, (_, r) => Array.from({ length: 25 }, (_, c) => (r * 37 + c * 53 + r * c) % 41));
const threeLetterWords = (() => {
  const out: string[] = [];
  for (const a of "abcde") for (const b of "abcde") for (const c of "abcde") out.push(a + b + c);
  return out.filter((w, i) => i % 4 !== 1);
})();

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
  {
    slug: "repaint-a-region",
    title: "Repaint a Region",
    pattern: "graphs",
    difficulty: "easy",
    rating: 1050,
    statement: `An image is a grid of integers \`image\`, where each value is the color of one pixel. You click the pixel at row \`sr\`, column \`sc\` with the paint-bucket tool and pick the color \`color\`.

The bucket repaints the clicked pixel and every pixel connected to it through up, down, left and right steps that has the same original color as the clicked pixel. Return the image after repainting.`,
    constraints: [
      "1 <= image.length, image[i].length <= 50",
      "0 <= image[i][j], color < 2^16",
      "0 <= sr < image.length, 0 <= sc < image[0].length",
    ],
    hints: [
      "Remember the clicked pixel's original color first. Which pixels should change?",
      "DFS or BFS from (sr, sc), visiting neighbors that still have the original color and painting each one. If the new color equals the original, return the image unchanged to avoid looping forever.",
      "old = image[sr][sc]\nif old == color: return image\ndef fill(r, c):\n    if 0 <= r < R and 0 <= c < C and image[r][c] == old:\n        image[r][c] = color\n        for dr, dc in DIRS: fill(r + dr, c + dc)\nfill(sr, sc); return image",
    ],
    complexity: { time: "O(m·n)", space: "O(m·n)" },
    signature: {
      kind: "function",
      name: "floodFill",
      params: [
        { name: "image", type: "int[][]" },
        { name: "sr", type: "int" },
        { name: "sc", type: "int" },
        { name: "color", type: "int" },
      ],
      returns: "int[][]",
    },
    tests: [
      { input: [[[1, 1, 1], [1, 1, 0], [1, 0, 1]], 1, 1, 2], expected: [[2, 2, 2], [2, 2, 0], [2, 0, 1]], sample: true },
      { input: [[[0, 0, 0], [0, 0, 0]], 0, 0, 0], expected: [[0, 0, 0], [0, 0, 0]], sample: true },
      { input: [[[5]], 0, 0, 9], expected: [[9]], label: "single pixel" },
      { input: [[[1, 2], [2, 1]], 0, 0, 3], expected: [[3, 2], [2, 1]], label: "no diagonal spread" },
      { input: [[[1, 1], [1, 1]], 1, 1, 1], expected: [[1, 1], [1, 1]], label: "same color" },
      { input: [[[0, 1, 0], [1, 1, 1], [0, 1, 0]], 1, 1, 4], expected: [[0, 4, 0], [4, 4, 4], [0, 4, 0]], label: "plus shape" },
      { input: [[[7, 7, 3, 7, 7]], 0, 4, 1], expected: [[7, 7, 3, 1, 1]], label: "single row, blocked" },
      { input: [[[2], [2], [5], [2]], 0, 0, 8], expected: [[8], [8], [5], [2]], label: "single column" },
      { input: [bigImage, 0, 0, 7], expected: repaintBySweeps(bigImage, 0, 0, 7), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Microsoft", "Apple"],
    source: { name: "LeetCode 733. Flood Fill", url: "https://leetcode.com/problems/flood-fill/" },
    reference: `function floodFill(image, sr, sc, color) {
  const old = image[sr][sc];
  if (old === color) return image;
  const R = image.length, C = image[0].length;
  const stack = [[sr, sc]];
  image[sr][sc] = color;
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nc >= 0 && nr < R && nc < C && image[nr][nc] === old) {
        image[nr][nc] = color;
        stack.push([nr, nc]);
      }
    }
  }
  return image;
}`,
  },
  {
    slug: "largest-island-size",
    title: "Largest Island Size",
    pattern: "graphs",
    difficulty: "medium",
    rating: 1220,
    statement: `A map is a grid \`grid\` of \`0\`s (water) and \`1\`s (land). An island is a group of land cells connected through up, down, left and right steps. Its size is the number of land cells in it.

Return the size of the largest island, or \`0\` if there is no land.`,
    constraints: ["1 <= grid.length, grid[i].length <= 50", "grid[i][j] is 0 or 1."],
    hints: [
      "Counting islands and measuring them are almost the same task. What would your flood fill return?",
      "Scan every cell. When you find unvisited land, flood fill from it (DFS or BFS), marking cells visited and counting them, and keep the largest count.",
      "best = 0\nfor r in range(R):\n    for c in range(C):\n        if grid[r][c] == 1:\n            size, stack = 0, [(r, c)]; grid[r][c] = 0\n            while stack:\n                y, x = stack.pop(); size += 1\n                for ny, nx in neighbors(y, x):\n                    if grid[ny][nx] == 1: grid[ny][nx] = 0; stack.append((ny, nx))\n            best = max(best, size)\nreturn best",
    ],
    complexity: { time: "O(m·n)", space: "O(m·n)" },
    signature: {
      kind: "function",
      name: "maxAreaOfIsland",
      params: [{ name: "grid", type: "int[][]" }],
      returns: "int",
    },
    tests: [
      {
        input: [[[0, 0, 1, 0, 0], [0, 1, 1, 0, 0], [0, 0, 0, 1, 1], [1, 1, 0, 1, 0]]],
        expected: 3,
        sample: true,
      },
      { input: [[[0, 0, 0, 0, 0, 0, 0, 0]]], expected: 0, sample: true },
      { input: [[[1]]], expected: 1, label: "single land cell" },
      { input: [[[1, 1], [1, 1]]], expected: 4, label: "all land" },
      { input: [[[1, 0], [0, 1]]], expected: 1, label: "diagonals do not connect" },
      { input: [[[1, 1, 0, 1, 1, 1]]], expected: 3, label: "single row" },
      { input: [[[1, 1, 1], [0, 0, 1], [1, 1, 1]]], expected: 7, label: "winding island" },
      { input: [bigIslands], expected: largestIslandBySweeps(bigIslands), label: "large input" },
    ],
    companies: ["Amazon", "Meta", "Google", "Bloomberg", "DoorDash"],
    source: { name: "LeetCode 695. Max Area of Island", url: "https://leetcode.com/problems/max-area-of-island/" },
    reference: `function maxAreaOfIsland(grid) {
  const R = grid.length, C = grid[0].length;
  const seen = grid.map((row) => row.map(() => false));
  let best = 0;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (grid[r][c] !== 1 || seen[r][c]) continue;
      let size = 0;
      const stack = [[r, c]];
      seen[r][c] = true;
      while (stack.length) {
        const [y, x] = stack.pop();
        size++;
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && nx >= 0 && ny < R && nx < C && grid[ny][nx] === 1 && !seen[ny][nx]) {
            seen[ny][nx] = true;
            stack.push([ny, nx]);
          }
        }
      }
      best = Math.max(best, size);
    }
  }
  return best;
}`,
  },
  {
    slug: "capture-enclosed-cells",
    title: "Capture Enclosed Cells",
    pattern: "graphs",
    difficulty: "medium",
    rating: 1420,
    statement: `A board \`board\` holds the characters \`"X"\` and \`"O"\`. A group of \`"O"\` cells connected through up, down, left and right steps is **enclosed** if none of its cells lies on the border of the board.

Change every \`"O"\` in every enclosed group to \`"X"\`. Modify \`board\` in place; your function does not need to return anything.`,
    constraints: ["1 <= board.length, board[i].length <= 200", "board[i][j] is \"X\" or \"O\"."],
    hints: [
      "Deciding whether a group is enclosed is hard from the inside. Which O cells are definitely safe?",
      "Flood fill from every O on the border and mark those cells safe. Then sweep the board: O cells that are not safe become X, and safe cells go back to O.",
      "for each border cell (r, c) with board[r][c] == 'O': fill(r, c)   # mark as 'S'\nfor r in range(R):\n    for c in range(C):\n        if board[r][c] == 'O': board[r][c] = 'X'\n        elif board[r][c] == 'S': board[r][c] = 'O'",
    ],
    complexity: { time: "O(m·n)", space: "O(m·n)" },
    signature: {
      kind: "function",
      name: "solve",
      params: [{ name: "board", type: "string[][]" }],
      returns: "void",
      inPlaceArg: 0,
    },
    tests: [
      {
        input: [[["X", "X", "X", "X"], ["X", "O", "O", "X"], ["X", "X", "O", "X"], ["X", "O", "X", "X"]]],
        expected: [["X", "X", "X", "X"], ["X", "X", "X", "X"], ["X", "X", "X", "X"], ["X", "O", "X", "X"]],
        sample: true,
      },
      { input: [[["X"]]], expected: [["X"]], sample: true },
      { input: [[["O"]]], expected: [["O"]], label: "single border O" },
      { input: [[["O", "O"], ["O", "O"]]], expected: [["O", "O"], ["O", "O"]], label: "everything on the border" },
      {
        input: [[["X", "X", "X"], ["X", "O", "X"], ["X", "X", "X"]]],
        expected: [["X", "X", "X"], ["X", "X", "X"], ["X", "X", "X"]],
        label: "one enclosed cell",
      },
      {
        input: [[["X", "O", "X"], ["X", "O", "X"], ["X", "X", "X"]]],
        expected: [["X", "O", "X"], ["X", "O", "X"], ["X", "X", "X"]],
        label: "connected to the border",
      },
      {
        input: [[["O", "X", "X", "O"], ["X", "O", "O", "X"], ["X", "O", "X", "X"], ["O", "X", "O", "O"]]],
        expected: captureBySweeps([["O", "X", "X", "O"], ["X", "O", "O", "X"], ["X", "O", "X", "X"], ["O", "X", "O", "O"]]),
        label: "diagonal touch does not save",
      },
      { input: [[["X", "O", "X", "O", "X"]]], expected: [["X", "O", "X", "O", "X"]], label: "single row" },
      { input: [bigBoard], expected: captureBySweeps(bigBoard), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Uber", "Microsoft"],
    source: { name: "LeetCode 130. Surrounded Regions", url: "https://leetcode.com/problems/surrounded-regions/" },
    reference: `function solve(board) {
  const R = board.length, C = board[0].length;
  const stack = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if ((r === 0 || c === 0 || r === R - 1 || c === C - 1) && board[r][c] === "O") {
      board[r][c] = "S";
      stack.push([r, c]);
    }
  }
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nc >= 0 && nr < R && nc < C && board[nr][nc] === "O") {
        board[nr][nc] = "S";
        stack.push([nr, nc]);
      }
    }
  }
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) board[r][c] = board[r][c] === "S" ? "O" : "X";
}`,
  },
  {
    slug: "runoff-to-both-coasts",
    title: "Runoff to Both Coasts",
    pattern: "graphs",
    difficulty: "medium",
    rating: 1550,
    statement: `A rectangular island is described by \`heights\`, where \`heights[r][c]\` is the elevation of cell \`(r, c)\`. The west coast touches the top and left edges of the grid; the east coast touches the bottom and right edges.

Rain on a cell flows to any neighbor (up, down, left, right) whose elevation is less than or equal to the current cell's, and from edge cells it flows into the adjacent coast. Return the coordinates \`[r, c]\` of every cell from which water can reach **both** coasts, in any order.`,
    constraints: ["1 <= heights.length, heights[i].length <= 200", "0 <= heights[r][c] <= 10^5"],
    hints: [
      "Checking every cell's downhill paths separately repeats a lot of work. Think about which cells each coast can collect water from.",
      "Run a BFS/DFS from every west-coast edge cell moving uphill (to neighbors with height >= current), and another from every east-coast edge cell. Answer: cells reached by both searches.",
      "def climb(starts):\n    seen = set(starts); stack = list(starts)\n    while stack:\n        r, c = stack.pop()\n        for nr, nc in neighbors(r, c):\n            if (nr, nc) not in seen and h[nr][nc] >= h[r][c]:\n                seen.add((nr, nc)); stack.append((nr, nc))\n    return seen\nwest = climb(top row + left column); east = climb(bottom row + right column)\nreturn [[r, c] for (r, c) in west & east]",
    ],
    complexity: { time: "O(m·n)", space: "O(m·n)" },
    signature: {
      kind: "function",
      name: "pacificAtlantic",
      params: [{ name: "heights", type: "int[][]" }],
      returns: "int[][]",
      compare: "unordered",
    },
    tests: [
      {
        input: [[[1, 2, 2, 3, 5], [3, 2, 3, 4, 4], [2, 4, 5, 3, 1], [6, 7, 1, 4, 5], [5, 1, 1, 2, 4]]],
        expected: [[0, 4], [1, 3], [1, 4], [2, 2], [3, 0], [3, 1], [4, 0]],
        sample: true,
      },
      { input: [[[1]]], expected: [[0, 0]], sample: true },
      { input: [[[1, 2, 3]]], expected: [[0, 0], [0, 1], [0, 2]], label: "single row touches both" },
      { input: [[[2, 2], [2, 2]]], expected: [[0, 0], [0, 1], [1, 0], [1, 1]], label: "flat land" },
      { input: [[[1, 1, 1], [1, 0, 1], [1, 1, 1]]], expected: bothCoastsBrute([[1, 1, 1], [1, 0, 1], [1, 1, 1]]), label: "pit in the middle" },
      { input: [[[3, 3, 3], [3, 1, 3], [0, 2, 4]]], expected: bothCoastsBrute([[3, 3, 3], [3, 1, 3], [0, 2, 4]]), label: "uneven corners" },
      { input: [[[10, 1], [1, 10]]], expected: [[0, 0], [0, 1], [1, 0], [1, 1]], label: "two by two" },
      { input: [bigHeights], expected: bothCoastsBrute(bigHeights), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Meta", "Uber"],
    source: { name: "LeetCode 417. Pacific Atlantic Water Flow", url: "https://leetcode.com/problems/pacific-atlantic-water-flow/" },
    reference: `function pacificAtlantic(heights) {
  const R = heights.length, C = heights[0].length;
  function climb(starts) {
    const seen = heights.map((row) => row.map(() => false));
    const stack = [];
    for (const [r, c] of starts) if (!seen[r][c]) { seen[r][c] = true; stack.push([r, c]); }
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= R || nc >= C || seen[nr][nc] || heights[nr][nc] < heights[r][c]) continue;
        seen[nr][nc] = true;
        stack.push([nr, nc]);
      }
    }
    return seen;
  }
  const west = [], east = [];
  for (let r = 0; r < R; r++) { west.push([r, 0]); east.push([r, C - 1]); }
  for (let c = 0; c < C; c++) { west.push([0, c]); east.push([R - 1, c]); }
  const a = climb(west), b = climb(east);
  const out = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (a[r][c] && b[r][c]) out.push([r, c]);
  return out;
}`,
  },
  {
    slug: "one-letter-step-chain",
    title: "One-Letter Step Chain",
    pattern: "graphs",
    difficulty: "hard",
    rating: 1720,
    statement: `You want to turn \`beginWord\` into \`endWord\` by changing one letter at a time. Every intermediate word, and \`endWord\` itself, must appear in the list \`wordList\`; \`beginWord\` does not need to be in the list.

Return the number of words in the shortest such chain, counting both \`beginWord\` and \`endWord\`, or \`0\` if no chain exists.`,
    constraints: [
      "1 <= beginWord.length <= 10",
      "endWord.length == beginWord.length",
      "1 <= wordList.length <= 5000",
      "All words have the same length and consist of lowercase English letters.",
      "beginWord != endWord, and the words in wordList are distinct.",
    ],
    hints: [
      "Treat each word as a node and connect words that differ in one letter. What search finds the fewest steps?",
      "BFS from beginWord. To find neighbors fast, either try all 26 letters at each position and look them up in a set, or group words by wildcard patterns like h*t.",
      "words = set(wordList)\nif endWord not in words: return 0\nqueue, seen = deque([(beginWord, 1)]), {beginWord}\nwhile queue:\n    w, d = queue.popleft()\n    if w == endWord: return d\n    for i in range(len(w)):\n        for ch in 'abcdefghijklmnopqrstuvwxyz':\n            v = w[:i] + ch + w[i+1:]\n            if v in words and v not in seen:\n                seen.add(v); queue.append((v, d + 1))\nreturn 0",
    ],
    complexity: { time: "O(n·L·26)", space: "O(n·L)" },
    signature: {
      kind: "function",
      name: "ladderLength",
      params: [
        { name: "beginWord", type: "string" },
        { name: "endWord", type: "string" },
        { name: "wordList", type: "string[]" },
      ],
      returns: "int",
    },
    tests: [
      { input: ["hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]], expected: 5, sample: true },
      { input: ["hit", "cog", ["hot", "dot", "dog", "lot", "log"]], expected: 0, sample: true },
      { input: ["a", "c", ["a", "b", "c"]], expected: 2, label: "single letters" },
      { input: ["hot", "dog", ["hot", "dog"]], expected: 0, label: "no middle word" },
      { input: ["hot", "hog", ["hog"]], expected: 2, label: "one step" },
      { input: ["lost", "cost", ["most", "fist", "lost", "cost", "fish"]], expected: 2, label: "begin word in list" },
      { input: ["abc", "xyz", ["abz", "ayz", "xyz", "xbc"]], expected: 4, label: "choose the right branch" },
      {
        input: ["red", "tax", ["ted", "tex", "red", "tax", "tad", "den", "rex", "pee"]],
        expected: stepChainBrute("red", "tax", ["ted", "tex", "red", "tax", "tad", "den", "rex", "pee"]),
        label: "several shortest chains",
      },
      { input: ["aaa", "eee", threeLetterWords], expected: stepChainBrute("aaa", "eee", threeLetterWords), label: "large input" },
      {
        input: ["aab", "edb", threeLetterWords.filter((w) => !w.startsWith("e") || w === "edb")],
        expected: stepChainBrute("aab", "edb", threeLetterWords.filter((w) => !w.startsWith("e") || w === "edb")),
        label: "large input, sparse",
      },
    ],
    companies: ["Amazon", "Meta", "Google", "LinkedIn", "Snap"],
    source: { name: "LeetCode 127. Word Ladder", url: "https://leetcode.com/problems/word-ladder/" },
    reference: `function ladderLength(beginWord, endWord, wordList) {
  const words = new Set(wordList);
  if (!words.has(endWord)) return 0;
  const seen = new Set([beginWord]);
  let frontier = [beginWord], depth = 1;
  while (frontier.length) {
    const next = [];
    for (const w of frontier) {
      if (w === endWord) return depth;
      for (let i = 0; i < w.length; i++) {
        for (let k = 0; k < 26; k++) {
          const v = w.slice(0, i) + String.fromCharCode(97 + k) + w.slice(i + 1);
          if (words.has(v) && !seen.has(v)) { seen.add(v); next.push(v); }
        }
      }
    }
    frontier = next;
    depth++;
  }
  return 0;
}`,
  },
];
