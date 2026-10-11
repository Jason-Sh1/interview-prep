import type { Problem } from "../types";

const prereqChain = (n: number) => Array.from({ length: n - 1 }, (_, i) => [i + 1, i]);
const weightedChain = (n: number) => Array.from({ length: n - 1 }, (_, i) => [i + 1, i + 2, 1]);
const diagonalPoints = (n: number) => Array.from({ length: n }, (_, i) => [i, i]);

export const advancedGraphs: Problem[] = [
  {
    slug: "finishable-curriculum",
    title: "Finishable Curriculum",
    pattern: "advanced-graphs",
    difficulty: "easy",
    rating: 1150,
    statement: `A program offers \`numCourses\` courses labeled \`0\` to \`numCourses - 1\`. Each pair \`prerequisites[i] = [a, b]\` means you must complete course \`b\` before you can take course \`a\`.

Return \`true\` if there is some order in which you can complete every course, and \`false\` otherwise.`,
    constraints: [
      "1 <= numCourses <= 2000",
      "0 <= prerequisites.length <= 5000",
      "0 <= a, b < numCourses",
    ],
    hints: [
      "When is it impossible to finish? Think about what the prerequisite graph would have to contain.",
      "Kahn's algorithm: count each course's unmet prerequisites (in-degree). Repeatedly take a course with in-degree 0 and decrement its dependents. You can finish everything iff you take all numCourses courses.",
      "indeg = [0] * n; adj = [[] for _ in range(n)]\nfor a, b in prerequisites: adj[b].append(a); indeg[a] += 1\nq = deque(i for i in range(n) if indeg[i] == 0); taken = 0\nwhile q:\n    u = q.popleft(); taken += 1\n    for v in adj[u]:\n        indeg[v] -= 1\n        if indeg[v] == 0: q.append(v)\nreturn taken == n",
    ],
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    signature: {
      kind: "function",
      name: "canFinish",
      params: [
        { name: "numCourses", type: "int" },
        { name: "prerequisites", type: "int[][]" },
      ],
      returns: "bool",
    },
    tests: [
      { input: [3, [[1, 0], [2, 1]]], expected: true, sample: true },
      { input: [2, [[1, 0], [0, 1]]], expected: false, sample: true },
      { input: [1, []], expected: true, label: "single course" },
      { input: [3, []], expected: true, label: "no prerequisites" },
      { input: [1, [[0, 0]]], expected: false, label: "self-dependency" },
      { input: [4, [[1, 0], [2, 1], [3, 2], [1, 3]]], expected: false, label: "cycle after a valid start" },
      { input: [5, [[1, 0], [2, 0], [3, 1], [3, 2], [4, 3]]], expected: true, label: "diamond" },
      { input: [6, [[1, 0], [2, 1], [4, 3], [5, 4], [3, 5]]], expected: false, label: "cycle in another component" },
      { input: [2000, prereqChain(2000)], expected: true, label: "long chain" },
    ],
    companies: ["Amazon", "Google", "Meta", "Microsoft", "Uber"],
    source: { name: "LeetCode 207. Course Schedule", url: "https://leetcode.com/problems/course-schedule/" },
    reference: `function canFinish(numCourses, prerequisites) {
  const adj = Array.from({ length: numCourses }, () => []);
  const indeg = new Array(numCourses).fill(0);
  for (const [a, b] of prerequisites) { adj[b].push(a); indeg[a]++; }
  const queue = [];
  for (let i = 0; i < numCourses; i++) if (indeg[i] === 0) queue.push(i);
  let taken = 0;
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h];
    taken++;
    for (const v of adj[u]) if (--indeg[v] === 0) queue.push(v);
  }
  return taken === numCourses;
}`,
  },
  {
    slug: "broadcast-delay",
    title: "Broadcast Delay",
    pattern: "advanced-graphs",
    difficulty: "medium",
    rating: 1400,
    statement: `A cluster has \`n\` servers labeled \`1\` to \`n\`. Each entry \`times[i] = [u, v, w]\` is a **one-way** link: a message sent from \`u\` reaches \`v\` after \`w\` milliseconds.

Server \`k\` broadcasts a message, and every server forwards it along all of its outgoing links the moment it first arrives.

Return the time it takes until every server has received the message. If some server never receives it, return \`-1\`.`,
    constraints: [
      "1 <= k <= n <= 100",
      "0 <= times.length <= 6000",
      "1 <= u, v <= n, u != v",
      "0 <= w <= 100",
      "There may be several links between the same pair of servers.",
    ],
    hints: [
      "Each server receives the message at its shortest-path distance from k. What is the answer in terms of those distances?",
      "Run Dijkstra's algorithm from k with a min-heap keyed by arrival time. The answer is the largest distance, or -1 if any server is unreached.",
      "dist = {}; heap = [(0, k)]\nwhile heap:\n    d, u = heappop(heap)\n    if u in dist: continue\n    dist[u] = d\n    for v, w in adj[u]:\n        if v not in dist: heappush(heap, (d + w, v))\nreturn max(dist.values()) if len(dist) == n else -1",
    ],
    complexity: { time: "O(E log V)", space: "O(V + E)" },
    signature: {
      kind: "function",
      name: "networkDelayTime",
      params: [
        { name: "times", type: "int[][]" },
        { name: "n", type: "int" },
        { name: "k", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: [[[1, 2, 4], [1, 3, 1], [3, 2, 2], [2, 4, 1]], 4, 1], expected: 4, sample: true },
      { input: [[[1, 2, 5]], 2, 2], expected: -1, sample: true },
      { input: [[], 1, 1], expected: 0, label: "single server" },
      { input: [[[1, 2, 3], [2, 1, 1]], 2, 1], expected: 3, label: "two-way pair" },
      { input: [[[1, 2, 1], [2, 3, 2], [1, 3, 4]], 3, 1], expected: 3, label: "longer path is faster" },
      { input: [[[1, 2, 1], [1, 3, 1]], 4, 1], expected: -1, label: "unreachable server" },
      { input: [[[1, 2, 7], [1, 2, 3]], 2, 1], expected: 3, label: "parallel links" },
      { input: [[[1, 2, 0], [2, 3, 0]], 3, 1], expected: 0, label: "zero-cost links" },
      { input: [[[3, 1, 2], [3, 2, 9], [1, 2, 3], [2, 4, 1]], 4, 3], expected: 6, label: "source in the middle" },
      { input: [weightedChain(100), 100, 1], expected: 99, label: "long chain" },
    ],
    companies: ["Google", "Amazon", "Meta"],
    source: { name: "LeetCode 743. Network Delay Time", url: "https://leetcode.com/problems/network-delay-time/" },
    reference: `class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) {
    const a = this.a; a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let s = i;
        if (l < a.length && a[l][0] < a[s][0]) s = l;
        if (r < a.length && a[r][0] < a[s][0]) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]]; i = s;
      }
    }
    return top;
  }
}

function networkDelayTime(times, n, k) {
  const adj = Array.from({ length: n + 1 }, () => []);
  for (const [u, v, w] of times) adj[u].push([v, w]);
  const dist = new Array(n + 1).fill(Infinity);
  const heap = new MinHeap();
  heap.push([0, k]);
  let reached = 0, best = 0;
  while (heap.size) {
    const [d, u] = heap.pop();
    if (dist[u] !== Infinity) continue;
    dist[u] = d; reached++; best = d;
    for (const [v, w] of adj[u]) if (dist[v] === Infinity) heap.push([d + w, v]);
  }
  return reached === n ? best : -1;
}`,
  },
  {
    slug: "cheapest-wiring",
    title: "Cheapest Wiring",
    pattern: "advanced-graphs",
    difficulty: "medium",
    rating: 1530,
    statement: `You are given the positions of \`n\` sensors on a city grid, where \`points[i] = [x, y]\`. Running a wire between sensors \`i\` and \`j\` costs their Manhattan distance, \`|xi - xj| + |yi - yj|\`.

Return the minimum total cost to wire the sensors so that every sensor is connected to every other (directly or through other sensors).`,
    constraints: ["1 <= points.length <= 1000", "-10^6 <= x, y <= 10^6", "All points are distinct."],
    hints: [
      "Connecting everything as cheaply as possible, with no wasted wires, means building a tree. Which kind of tree?",
      "This is a minimum spanning tree on a complete graph. Prim's algorithm with an O(n) scan per step (no heap) gives O(n²), which beats sorting all n² edges.",
      "best = [inf] * n; best[0] = 0; used = [False] * n; total = 0\nfor _ in range(n):\n    u = argmin of best[i] over unused i\n    used[u] = True; total += best[u]\n    for v unused: best[v] = min(best[v], dist(u, v))\nreturn total",
    ],
    complexity: { time: "O(n²)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "minCostConnectPoints",
      params: [{ name: "points", type: "int[][]" }],
      returns: "int",
    },
    tests: [
      { input: [[[0, 0], [1, 1], [1, 0], [-1, 1]]], expected: 4, sample: true },
      { input: [[[0, 0], [0, 5], [5, 5]]], expected: 10, sample: true },
      { input: [[[7, 7]]], expected: 0, label: "single sensor" },
      { input: [[[0, 0], [3, 4]]], expected: 7, label: "two sensors" },
      { input: [[[0, 0], [10, 0], [10, 10], [0, 10]]], expected: 30, label: "square" },
      { input: [[[0, 0], [1, 0], [3, 0], [6, 0], [10, 0]]], expected: 10, label: "collinear" },
      { input: [[[-1000000, -1000000], [1000000, 1000000]]], expected: 4000000, label: "large coordinates" },
      { input: [[[0, 0], [2, 2], [3, 10], [5, 2], [7, 0]]], expected: 20, label: "scattered" },
      { input: [diagonalPoints(300)], expected: 598, label: "many sensors" },
    ],
    companies: ["Amazon", "Google", "Microsoft"],
    source: {
      name: "LeetCode 1584. Min Cost to Connect All Points",
      url: "https://leetcode.com/problems/min-cost-to-connect-all-points/",
    },
    reference: `function minCostConnectPoints(points) {
  const n = points.length;
  const best = new Array(n).fill(Infinity);
  const used = new Array(n).fill(false);
  best[0] = 0;
  let total = 0;
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!used[i] && (u === -1 || best[i] < best[u])) u = i;
    used[u] = true;
    total += best[u];
    for (let v = 0; v < n; v++) {
      if (used[v]) continue;
      const d = Math.abs(points[u][0] - points[v][0]) + Math.abs(points[u][1] - points[v][1]);
      if (d < best[v]) best[v] = d;
    }
  }
  return total;
}`,
  },
];
