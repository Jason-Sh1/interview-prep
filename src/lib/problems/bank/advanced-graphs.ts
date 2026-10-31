import type { Problem } from "../types";

const prereqChain = (n: number) => Array.from({ length: n - 1 }, (_, i) => [i + 1, i]);
const weightedChain = (n: number) => Array.from({ length: n - 1 }, (_, i) => [i + 1, i + 2, 1]);
const diagonalPoints = (n: number) => Array.from({ length: n }, (_, i) => [i, i]);

// Brute-force helpers for expected values.
function trustedBrute(n: number, trust: number[][]): number {
  for (let p = 1; p <= n; p++) {
    const trustsSomeone = trust.some(([a]) => a === p);
    const trustedByAll = Array.from({ length: n }, (_, i) => i + 1).every(
      (q) => q === p || trust.some(([a, b]) => a === q && b === p),
    );
    if (!trustsSomeone && trustedByAll) return p;
  }
  return -1;
}

function termsByRelaxing(n: number, relations: number[][]): number {
  const term = new Array(n + 1).fill(1);
  for (let round = 0; round <= n; round++) {
    let changed = false;
    for (const [a, b] of relations)
      if (term[b] < term[a] + 1) {
        term[b] = term[a] + 1;
        changed = true;
      }
    if (!changed) return Math.max(...term.slice(1));
  }
  return -1;
}

function cheapestByRounds(n: number, flights: number[][], src: number, dst: number, k: number): number {
  let cost = new Array(n).fill(Infinity);
  cost[src] = 0;
  for (let i = 0; i <= k; i++) {
    const next = cost.slice();
    for (const [a, b, p] of flights) if (cost[a] + p < next[b]) next[b] = cost[a] + p;
    cost = next;
  }
  return cost[dst] === Infinity ? -1 : cost[dst];
}

function tideByTrying(grid: number[][]): number {
  const n = grid.length;
  for (let t = Math.max(grid[0][0], grid[n - 1][n - 1]); ; t++) {
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) {
      const cell = stack.pop()!;
      const r = Math.floor(cell / n), c = cell % n;
      for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
        if (nr < 0 || nc < 0 || nr >= n || nc >= n || grid[nr][nc] > t || seen.has(nr * n + nc)) continue;
        seen.add(nr * n + nc);
        stack.push(nr * n + nc);
      }
    }
    if (seen.has(n * n - 1)) return t;
  }
}

function tripByBacktracking(tickets: string[][]): string[] {
  const order = tickets.map((t, i) => i).sort((a, b) => (tickets[a][1] < tickets[b][1] ? -1 : tickets[a][1] > tickets[b][1] ? 1 : 0));
  const used = new Array(tickets.length).fill(false);
  const path = ["JFK"];
  function go(): boolean {
    if (path.length === tickets.length + 1) return true;
    const here = path[path.length - 1];
    let lastTried = "";
    for (const i of order) {
      if (used[i] || tickets[i][0] !== here || tickets[i][1] === lastTried) continue;
      lastTried = tickets[i][1];
      used[i] = true;
      path.push(tickets[i][1]);
      if (go()) return true;
      path.pop();
      used[i] = false;
    }
    return false;
  }
  go();
  return path;
}

// A spiral of distinct elevations: the only way across is to wind along it.
const spiralGrid = (n: number) => {
  const g = Array.from({ length: n }, () => new Array(n).fill(0));
  let v = 0, top = 0, left = 0, bottom = n - 1, right = n - 1;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) g[top][c] = v++;
    for (let r = top + 1; r <= bottom; r++) g[r][right] = v++;
    for (let c = right - 1; c >= left && top < bottom; c--) g[bottom][c] = v++;
    for (let r = bottom - 1; r > top && left < right; r--) g[r][left] = v++;
    top++;
    left++;
    bottom--;
    right--;
  }
  return g;
};
const scrambledGrid = (n: number) => {
  const g = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n * n; i++) g[Math.floor(i / n)][i % n] = (i * 37 + 11) % (n * n);
  return g;
};
const bigTide = scrambledGrid(25);
const bigSpiral = spiralGrid(20);

const AIRPORTS = ["JFK", "ATL", "SFO", "LAX", "ORD", "SEA"];
const tripTickets = (() => {
  const route = ["JFK"];
  for (let i = 0; route.length < 31; i++) {
    const next = AIRPORTS[(i * 7 + 3) % 6 === AIRPORTS.indexOf(route[route.length - 1]) ? (i * 7 + 4) % 6 : (i * 7 + 3) % 6];
    route.push(next);
  }
  const tickets = route.slice(1).map((to, i) => [route[i], to]);
  return tickets.map((_, i) => tickets[(i * 11) % tickets.length]);
})();

const bigFlights = (() => {
  const out: number[][] = [];
  for (let a = 0; a < 60; a++) for (let d = 1; d <= 4; d++) out.push([a, (a + d * 7) % 60, ((a * 13 + d * 29) % 50) + 1]);
  return out.filter(([a, b]) => a !== b);
})();
const bigCourses = Array.from({ length: 300 }, (_, i) => [((i * 7) % 150) + 1, ((i * 7) % 150) + 1 + ((i % 5) + 1)]).filter(
  ([, b]) => b <= 150,
);

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
  {
    slug: "trusted-by-everyone",
    title: "Trusted by Everyone",
    pattern: "advanced-graphs",
    difficulty: "easy",
    rating: 1020,
    statement: `A town has \`n\` residents labeled \`1\` to \`n\`. Each pair \`trust[i] = [a, b]\` means resident \`a\` trusts resident \`b\` (trust is one-way).

Rumor says one resident is the town's arbiter: the arbiter trusts nobody, and every other resident trusts the arbiter. At most one resident can satisfy both conditions. Return the arbiter's label if they exist, or \`-1\` otherwise.`,
    constraints: [
      "1 <= n <= 1000",
      "0 <= trust.length <= 10^4",
      "trust[i] = [a, b] with a != b, 1 <= a, b <= n",
      "All pairs in trust are distinct.",
    ],
    hints: [
      "Think of trust as directed edges. What do the arbiter's incoming and outgoing edge counts look like?",
      "The arbiter has in-degree n - 1 and out-degree 0. Keep one score per person: +1 for each incoming edge, -1 for each outgoing edge, and look for a score of n - 1.",
      "score = [0] * (n + 1)\nfor a, b in trust:\n    score[a] -= 1\n    score[b] += 1\nfor p in range(1, n + 1):\n    if score[p] == n - 1: return p\nreturn -1",
    ],
    complexity: { time: "O(n + E)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "findJudge",
      params: [
        { name: "n", type: "int" },
        { name: "trust", type: "int[][]" },
      ],
      returns: "int",
    },
    tests: [
      { input: [2, [[1, 2]]], expected: 2, sample: true },
      { input: [3, [[1, 3], [2, 3], [3, 1]]], expected: -1, sample: true },
      { input: [3, [[1, 3], [2, 3]]], expected: 3, label: "everyone trusts one" },
      { input: [1, []], expected: 1, label: "single resident" },
      { input: [2, []], expected: -1, label: "nobody trusts anyone" },
      { input: [3, [[1, 2], [2, 3]]], expected: -1, label: "chain of trust" },
      { input: [4, [[1, 3], [1, 4], [2, 3], [2, 4], [4, 3]]], expected: 3, label: "extra trust edges" },
      { input: [4, [[1, 2], [3, 2], [2, 4]]], expected: -1, label: "candidate trusts someone" },
      {
        input: [1000, [...Array.from({ length: 999 }, (_, i) => [i + 1, 1000]), ...Array.from({ length: 998 }, (_, i) => [i + 1, i + 2])]],
        expected: trustedBrute(1000, [...Array.from({ length: 999 }, (_, i) => [i + 1, 1000]), ...Array.from({ length: 998 }, (_, i) => [i + 1, i + 2])]),
        label: "large input",
      },
    ],
    companies: ["Amazon", "Meta", "Microsoft", "Apple"],
    source: { name: "LeetCode 997. Find the Town Judge", url: "https://leetcode.com/problems/find-the-town-judge/" },
    reference: `function findJudge(n, trust) {
  const score = new Array(n + 1).fill(0);
  for (const [a, b] of trust) { score[a]--; score[b]++; }
  for (let p = 1; p <= n; p++) if (score[p] === n - 1) return p;
  return -1;
}`,
  },
  {
    slug: "fewest-terms-to-graduate",
    title: "Fewest Terms to Graduate",
    pattern: "advanced-graphs",
    difficulty: "medium",
    rating: 1300,
    statement: `A program has \`n\` courses labeled \`1\` to \`n\`. Each pair \`relations[i] = [before, after]\` means \`before\` must be passed in an earlier term than \`after\`.

In a single term you may take any number of courses, as long as every prerequisite of each one was passed in an earlier term. Return the fewest terms needed to pass every course, or \`-1\` if the prerequisites make that impossible.`,
    constraints: [
      "1 <= n <= 5000",
      "0 <= relations.length <= 5000",
      "1 <= before, after <= n, before != after",
      "All pairs are distinct.",
    ],
    hints: [
      "In the first term you can take every course with no prerequisites. What can you take in the second term?",
      "Kahn's algorithm in layers: start with all in-degree-0 courses, and each round remove them, lowering in-degrees, and collect the courses that reach 0. The number of rounds is the answer; if some course never reaches 0, there is a cycle.",
      "indeg, adj = [0] * (n + 1), defaultdict(list)\nfor a, b in relations: adj[a].append(b); indeg[b] += 1\nlayer = [c for c in range(1, n + 1) if indeg[c] == 0]\nterms = taken = 0\nwhile layer:\n    terms += 1; taken += len(layer); nxt = []\n    for c in layer:\n        for d in adj[c]:\n            indeg[d] -= 1\n            if indeg[d] == 0: nxt.append(d)\n    layer = nxt\nreturn terms if taken == n else -1",
    ],
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    signature: {
      kind: "function",
      name: "minimumSemesters",
      params: [
        { name: "n", type: "int" },
        { name: "relations", type: "int[][]" },
      ],
      returns: "int",
    },
    tests: [
      { input: [3, [[1, 3], [2, 3]]], expected: 2, sample: true },
      { input: [3, [[1, 2], [2, 3], [3, 1]]], expected: -1, sample: true },
      { input: [1, []], expected: 1, label: "single course" },
      { input: [4, []], expected: 1, label: "no prerequisites" },
      { input: [4, [[1, 2], [2, 3], [3, 4]]], expected: 4, label: "one long chain" },
      { input: [2, [[1, 2], [2, 1]]], expected: -1, label: "two-course cycle" },
      { input: [5, [[1, 2], [1, 3], [3, 4], [2, 4], [4, 5], [1, 5]]], expected: 4, label: "longest chain wins" },
      { input: [5, [[2, 3], [3, 4], [4, 3]]], expected: -1, label: "cycle in a separate part" },
      { input: [150, bigCourses], expected: termsByRelaxing(150, bigCourses), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Uber"],
    source: { name: "LeetCode 1136. Parallel Courses", url: "https://leetcode.com/problems/parallel-courses/" },
    reference: `function minimumSemesters(n, relations) {
  const indeg = new Array(n + 1).fill(0);
  const adj = Array.from({ length: n + 1 }, () => []);
  for (const [a, b] of relations) { adj[a].push(b); indeg[b]++; }
  let layer = [];
  for (let c = 1; c <= n; c++) if (indeg[c] === 0) layer.push(c);
  let terms = 0, taken = 0;
  while (layer.length) {
    terms++;
    taken += layer.length;
    const next = [];
    for (const c of layer) for (const d of adj[c]) if (--indeg[d] === 0) next.push(d);
    layer = next;
  }
  return taken === n ? terms : -1;
}`,
  },
  {
    slug: "cheapest-route-with-few-layovers",
    title: "Cheapest Route With Few Layovers",
    pattern: "advanced-graphs",
    difficulty: "medium",
    rating: 1560,
    statement: `There are \`n\` cities labeled \`0\` to \`n - 1\`. Each \`flights[i] = [from, to, price]\` is a one-way flight.

Return the cheapest total price to get from city \`src\` to city \`dst\` using at most \`k\` layovers (a route with \`k\` layovers takes \`k + 1\` flights). If no such route exists, return \`-1\`.`,
    constraints: [
      "1 <= n <= 100",
      "0 <= flights.length <= n * (n - 1) / 2",
      "0 <= from, to < n, from != to, and there is at most one flight per (from, to) pair",
      "1 <= price <= 10^4",
      "0 <= src, dst, k < n, src != dst",
    ],
    hints: [
      "Plain Dijkstra finds the cheapest route but ignores how many flights it uses. What extra limit do you need to respect?",
      "Bellman-Ford limited to k + 1 rounds: each round, relax every flight using the costs from the previous round only (copy the array first), so each round adds at most one flight.",
      "cost = [inf] * n; cost[src] = 0\nfor _ in range(k + 1):\n    nxt = cost[:]\n    for a, b, p in flights:\n        if cost[a] + p < nxt[b]: nxt[b] = cost[a] + p\n    cost = nxt\nreturn -1 if cost[dst] == inf else cost[dst]",
    ],
    complexity: { time: "O(k·E)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "findCheapestPrice",
      params: [
        { name: "n", type: "int" },
        { name: "flights", type: "int[][]" },
        { name: "src", type: "int" },
        { name: "dst", type: "int" },
        { name: "k", type: "int" },
      ],
      returns: "int",
    },
    tests: [
      { input: [4, [[0, 1, 100], [1, 2, 100], [2, 0, 100], [1, 3, 600], [2, 3, 200]], 0, 3, 1], expected: 700, sample: true },
      { input: [3, [[0, 1, 100], [1, 2, 100], [0, 2, 500]], 0, 2, 1], expected: 200, sample: true },
      { input: [3, [[0, 1, 100], [1, 2, 100], [0, 2, 500]], 0, 2, 0], expected: 500, label: "no layovers allowed" },
      { input: [2, [], 0, 1, 1], expected: -1, label: "no flights" },
      { input: [3, [[0, 1, 5], [1, 2, 5]], 0, 2, 0], expected: -1, label: "needs a layover" },
      { input: [2, [[1, 0, 5]], 0, 1, 1], expected: -1, label: "wrong direction" },
      {
        input: [5, [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 1], [0, 4, 10]], 0, 4, 2],
        expected: 10,
        label: "cheap route has too many stops",
      },
      {
        input: [5, [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 1], [0, 4, 10]], 0, 4, 3],
        expected: 4,
        label: "cheap route fits",
      },
      { input: [60, bigFlights, 0, 59, 4], expected: cheapestByRounds(60, bigFlights, 0, 59, 4), label: "large input" },
      { input: [60, bigFlights, 5, 42, 10], expected: cheapestByRounds(60, bigFlights, 5, 42, 10), label: "large input, many stops" },
    ],
    companies: ["Amazon", "Airbnb", "Google", "Meta", "Snap"],
    source: {
      name: "LeetCode 787. Cheapest Flights Within K Stops",
      url: "https://leetcode.com/problems/cheapest-flights-within-k-stops/",
    },
    reference: `function findCheapestPrice(n, flights, src, dst, k) {
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b, p] of flights) adj[a].push([b, p]);
  // BFS by number of flights, keeping the best cost seen per city.
  const best = new Array(n).fill(Infinity);
  best[src] = 0;
  let frontier = [[src, 0]];
  for (let flightsUsed = 0; flightsUsed <= k && frontier.length; flightsUsed++) {
    const next = [];
    for (const [city, cost] of frontier) {
      for (const [to, p] of adj[city]) {
        if (cost + p < best[to]) {
          best[to] = cost + p;
          next.push([to, cost + p]);
        }
      }
    }
    frontier = next;
  }
  return best[dst] === Infinity ? -1 : best[dst];
}`,
  },
  {
    slug: "rising-tide-crossing",
    title: "Rising Tide Crossing",
    pattern: "advanced-graphs",
    difficulty: "hard",
    rating: 1650,
    statement: `An \`n x n\` grid \`grid\` holds every integer from \`0\` to \`n² - 1\` exactly once; \`grid[r][c]\` is the height of cell \`(r, c)\`. Water starts at level 0 and, at time \`t\`, stands at level \`t\` everywhere.

You can swim from a cell to a neighbor (up, down, left, right) instantly, but only when both cells' heights are at most the current water level. Starting at the top-left cell, return the earliest time at which you can reach the bottom-right cell.`,
    constraints: ["1 <= n <= 50", "grid holds each value from 0 to n² - 1 exactly once."],
    hints: [
      "The time a route needs is the highest cell on it. You want the route whose highest cell is as low as possible.",
      "Run Dijkstra where a path's cost is the maximum height so far: pop the cell with the lowest cost from a min-heap and push neighbors with cost max(current, height). Alternatively, binary search the time and flood fill.",
      "heap = [(grid[0][0], 0, 0)]; seen = {(0, 0)}\nwhile heap:\n    t, r, c = heappop(heap)\n    if (r, c) == (n - 1, n - 1): return t\n    for nr, nc in neighbors(r, c):\n        if (nr, nc) not in seen:\n            seen.add((nr, nc))\n            heappush(heap, (max(t, grid[nr][nc]), nr, nc))",
    ],
    complexity: { time: "O(n^2 log n)", space: "O(n^2)" },
    signature: {
      kind: "function",
      name: "swimInWater",
      params: [{ name: "grid", type: "int[][]" }],
      returns: "int",
    },
    tests: [
      { input: [[[0, 2], [1, 3]]], expected: 3, sample: true },
      {
        input: [[[0, 1, 2, 3, 4], [24, 23, 22, 21, 5], [12, 13, 14, 15, 16], [11, 17, 18, 19, 20], [10, 9, 8, 7, 6]]],
        expected: 16,
        sample: true,
      },
      { input: [[[0]]], expected: 0, label: "single cell" },
      { input: [[[3, 2], [0, 1]]], expected: 3, label: "start is the highest" },
      { input: [[[0, 3], [2, 1]]], expected: 2, label: "go around the high cell" },
      { input: [[[0, 1, 2], [7, 8, 3], [6, 5, 4]]], expected: 4, label: "walk the rim" },
      { input: [[[0, 8, 2], [1, 7, 3], [6, 5, 4]]], expected: tideByTrying([[0, 8, 2], [1, 7, 3], [6, 5, 4]]), label: "two candidate routes" },
      { input: [bigSpiral], expected: tideByTrying(bigSpiral), label: "large input, spiral" },
      { input: [bigTide], expected: tideByTrying(bigTide), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Uber", "Meta"],
    source: { name: "LeetCode 778. Swim in Rising Water", url: "https://leetcode.com/problems/swim-in-rising-water/" },
    reference: `function swimInWater(grid) {
  const n = grid.length;
  // Union-find: raise the water one level at a time, joining the cell at that height to its lit neighbors.
  const parent = Array.from({ length: n * n }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const where = new Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) where[grid[r][c]] = [r, c];
  for (let t = 0; t < n * n; t++) {
    const [r, c] = where[t];
    for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
      if (nr >= 0 && nc >= 0 && nr < n && nc < n && grid[nr][nc] <= t) parent[find(r * n + c)] = find(nr * n + nc);
    }
    if (find(0) === find(n * n - 1)) return t;
  }
  return n * n - 1;
}`,
  },
  {
    slug: "rebuild-the-trip",
    title: "Rebuild the Trip",
    pattern: "advanced-graphs",
    difficulty: "hard",
    rating: 1760,
    statement: `You found a pile of used plane tickets, each written as \`[from, to]\` with three-letter airport codes. They all belong to one traveler who started at \`"JFK"\` and used every ticket exactly once.

Rebuild the list of airports visited, in order, starting with \`"JFK"\`. If several orders use every ticket, return the one that comes first when you compare the lists airport by airport alphabetically. At least one valid order is guaranteed to exist.`,
    constraints: [
      "1 <= tickets.length <= 300",
      "tickets[i] = [from, to], each a code of 3 uppercase English letters, from != to",
      "Tickets may repeat (the same flight taken twice).",
    ],
    hints: [
      "Greedily always flying to the alphabetically smallest airport can strand you with unused tickets. When does that happen, and how can you recover?",
      "This is an Eulerian path. Hierholzer's algorithm: DFS from JFK always taking the smallest unused ticket, and append an airport to the answer only after all its outgoing tickets are used. Reverse at the end.",
      "adj = defaultdict(list)\nfor a, b in sorted(tickets, reverse=True): adj[a].append(b)\nroute = []\ndef visit(a):\n    while adj[a]:\n        visit(adj[a].pop())   # pops the smallest\n    route.append(a)\nvisit('JFK')\nreturn route[::-1]",
    ],
    complexity: { time: "O(E log E)", space: "O(E)" },
    signature: {
      kind: "function",
      name: "findItinerary",
      params: [{ name: "tickets", type: "string[][]" }],
      returns: "string[]",
    },
    tests: [
      {
        input: [[["MUC", "LHR"], ["JFK", "MUC"], ["SFO", "SJC"], ["LHR", "SFO"]]],
        expected: ["JFK", "MUC", "LHR", "SFO", "SJC"],
        sample: true,
      },
      {
        input: [[["JFK", "SFO"], ["JFK", "ATL"], ["SFO", "ATL"], ["ATL", "JFK"], ["ATL", "SFO"]]],
        expected: ["JFK", "ATL", "JFK", "SFO", "ATL", "SFO"],
        sample: true,
      },
      { input: [[["JFK", "LAX"]]], expected: ["JFK", "LAX"], label: "single ticket" },
      {
        input: [[["JFK", "KUL"], ["JFK", "NRT"], ["NRT", "JFK"]]],
        expected: ["JFK", "NRT", "JFK", "KUL"],
        label: "smallest first would strand you",
      },
      {
        input: [[["JFK", "AAA"], ["AAA", "JFK"], ["JFK", "AAA"], ["AAA", "JFK"]]],
        expected: ["JFK", "AAA", "JFK", "AAA", "JFK"],
        label: "repeated tickets",
      },
      {
        input: [[["JFK", "BOS"], ["BOS", "JFK"], ["JFK", "ATL"]]],
        expected: tripByBacktracking([["JFK", "BOS"], ["BOS", "JFK"], ["JFK", "ATL"]]),
        label: "dead end must come last",
      },
      {
        input: [[["EZE", "AXA"], ["TIA", "ANU"], ["ANU", "JFK"], ["JFK", "ANU"], ["ANU", "EZE"], ["TIA", "ANU"], ["AXA", "TIA"], ["TIA", "JFK"], ["ANU", "TIA"], ["JFK", "TIA"]]],
        expected: tripByBacktracking([["EZE", "AXA"], ["TIA", "ANU"], ["ANU", "JFK"], ["JFK", "ANU"], ["ANU", "EZE"], ["TIA", "ANU"], ["AXA", "TIA"], ["TIA", "JFK"], ["ANU", "TIA"], ["JFK", "TIA"]]),
        label: "many loops",
      },
      { input: [tripTickets], expected: tripByBacktracking(tripTickets), label: "large input" },
    ],
    companies: ["Google", "Uber", "Airbnb", "Amazon", "Meta"],
    source: { name: "LeetCode 332. Reconstruct Itinerary", url: "https://leetcode.com/problems/reconstruct-itinerary/" },
    reference: `function findItinerary(tickets) {
  const adj = new Map();
  const sorted = tickets.slice().sort((x, y) => (x[1] < y[1] ? 1 : x[1] > y[1] ? -1 : 0));
  for (const [a, b] of sorted) {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push(b);
  }
  const route = [];
  const stack = ["JFK"];
  while (stack.length) {
    const top = stack[stack.length - 1];
    const out = adj.get(top);
    if (out && out.length) stack.push(out.pop());
    else route.push(stack.pop());
  }
  return route.reverse();
}`,
  },
];
