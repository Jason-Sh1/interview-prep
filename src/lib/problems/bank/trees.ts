import type { Problem } from "../types";

export const trees: Problem[] = [
  {
    slug: "mirror-the-tree",
    title: "Mirror the Tree",
    pattern: "trees",
    difficulty: "easy",
    rating: 980,
    statement: `Given the \`root\` of a binary tree, turn it into its mirror image: at every node, the left and right subtrees trade places. Return the root of the mirrored tree.`,
    constraints: [
      "The tree has between 0 and 100 nodes",
      "-100 <= Node.val <= 100",
    ],
    hints: [
      "If you already had the mirrored versions of both subtrees, what is left to do at the root?",
      "Recursively mirror the left and right subtrees, then swap them. An empty tree mirrors to itself. A BFS that swaps children at every node also works.",
      "def mirror(node):\n    if not node: return None\n    node.left, node.right = mirror(node.right), mirror(node.left)\n    return node",
    ],
    complexity: { time: "O(n)", space: "O(h)" },
    signature: {
      kind: "function",
      name: "invertTree",
      params: [{ name: "root", type: "TreeNode" }],
      returns: "TreeNode",
    },
    tests: [
      { input: [[4, 2, 7, 1, 3, 6, 9]], expected: [4, 7, 2, 9, 6, 3, 1], sample: true },
      { input: [[2, 1, 3]], expected: [2, 3, 1], sample: true },
      { input: [[]], expected: [], label: "empty tree" },
      { input: [[1]], expected: [1], label: "single node" },
      { input: [[1, 2]], expected: [1, null, 2], label: "one child" },
      { input: [[1, 2, null, 3]], expected: [1, null, 2, null, 3], label: "left-skewed tree" },
      { input: [[1, null, 2, null, 3]], expected: [1, 2, null, 3], label: "right-skewed tree" },
      { input: [[-1, -2, -3, 0]], expected: [-1, -3, -2, null, null, null, 0], label: "negatives" },
    ],
    companies: ["Google", "Amazon", "Meta", "Microsoft"],
    source: { name: "LeetCode 226. Invert Binary Tree", url: "https://leetcode.com/problems/invert-binary-tree/" },
    reference: `function invertTree(root) {
  if (!root) return null;
  const left = invertTree(root.left);
  root.left = invertTree(root.right);
  root.right = left;
  return root;
}`,
  },
  {
    slug: "rows-of-a-tree",
    title: "Rows of a Tree",
    pattern: "trees",
    difficulty: "medium",
    rating: 1250,
    statement: `Given the \`root\` of a binary tree, list its node values row by row. The first row is the root alone, the next row is the root's children, and so on. Within a row, list values from left to right.

Return a list of rows, where each row is a list of values. An empty tree has no rows.`,
    constraints: [
      "The tree has between 0 and 2000 nodes",
      "-1000 <= Node.val <= 1000",
    ],
    hints: [
      "Which data structure hands you nodes in the order they were discovered?",
      "Use a queue (BFS). At the start of each round, the queue holds exactly one row: record its size, pop that many nodes, and push their children.",
      "rows, q = [], deque([root]) if root else deque()\nwhile q:\n    row = []\n    for _ in range(len(q)):\n        n = q.popleft(); row.append(n.val)\n        push n.left, n.right if present\n    rows.append(row)",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "levelOrder",
      params: [{ name: "root", type: "TreeNode" }],
      returns: "int[][]",
    },
    tests: [
      { input: [[3, 9, 20, null, null, 15, 7]], expected: [[3], [9, 20], [15, 7]], sample: true },
      { input: [[1, 2, 3, 4, 5, 6, 7]], expected: [[1], [2, 3], [4, 5, 6, 7]], sample: true },
      { input: [[]], expected: [], label: "empty tree" },
      { input: [[1]], expected: [[1]], label: "single node" },
      { input: [[1, 2, null, 3, null, 4]], expected: [[1], [2], [3], [4]], label: "left-skewed tree" },
      { input: [[1, 2, 3, null, 4, null, 5]], expected: [[1], [2, 3], [4, 5]], label: "gaps in rows" },
      { input: [[0, -1, -1]], expected: [[0], [-1, -1]], label: "duplicates and negatives" },
    ],
    companies: ["Amazon", "Meta", "Microsoft", "LinkedIn", "Bloomberg"],
    source: {
      name: "LeetCode 102. Binary Tree Level Order Traversal",
      url: "https://leetcode.com/problems/binary-tree-level-order-traversal/",
    },
    reference: `function levelOrder(root) {
  const rows = [];
  if (!root) return rows;
  let q = [root];
  while (q.length) {
    const next = [];
    const row = [];
    for (const n of q) {
      row.push(n.val);
      if (n.left) next.push(n.left);
      if (n.right) next.push(n.right);
    }
    rows.push(row);
    q = next;
  }
  return rows;
}`,
  },
  {
    slug: "heaviest-tree-route",
    title: "Heaviest Tree Route",
    pattern: "trees",
    difficulty: "hard",
    rating: 1750,
    statement: `In a binary tree, a *route* is a sequence of nodes where each consecutive pair is joined by an edge and no node appears twice. A route has at least one node and does not need to pass through the root. Its weight is the sum of the values of its nodes.

Given the \`root\` of a non-empty binary tree, return the largest weight of any route.`,
    constraints: [
      "The tree has between 1 and 3 * 10^4 nodes",
      "-1000 <= Node.val <= 1000",
    ],
    hints: [
      "Every route has a single highest node. At that node, the route goes down into at most the left side and the right side.",
      "Write a DFS that returns the best downward path starting at a node (never below 0 for its children's contributions). While at a node, update a global best with node.val + left gain + right gain.",
      "best = -inf\ndef gain(n):\n    if not n: return 0\n    l = max(gain(n.left), 0); r = max(gain(n.right), 0)\n    best = max(best, n.val + l + r)\n    return n.val + max(l, r)",
    ],
    complexity: { time: "O(n)", space: "O(h)" },
    signature: {
      kind: "function",
      name: "maxPathSum",
      params: [{ name: "root", type: "TreeNode" }],
      returns: "int",
    },
    tests: [
      { input: [[1, 2, 3]], expected: 6, sample: true },
      { input: [[-10, 9, 20, null, null, 15, 7]], expected: 42, sample: true },
      { input: [[-3]], expected: -3, label: "single negative node" },
      { input: [[2, -1]], expected: 2, label: "skip negative child" },
      { input: [[-2, -1]], expected: -1, label: "all negative" },
      { input: [[1, -2, 3]], expected: 4, label: "one-sided route" },
      { input: [[1, null, 2, null, 3]], expected: 6, label: "skewed tree" },
      { input: [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]], expected: 48, label: "route avoids root's best leaf" },
      { input: [[-1, 5, -2, 4, 3]], expected: 12, label: "best route below the root" },
    ],
    companies: ["Meta", "Google", "Amazon", "Microsoft", "DoorDash"],
    source: {
      name: "LeetCode 124. Binary Tree Maximum Path Sum",
      url: "https://leetcode.com/problems/binary-tree-maximum-path-sum/",
    },
    reference: `function maxPathSum(root) {
  let best = -Infinity;
  function gain(n) {
    if (!n) return 0;
    const l = Math.max(gain(n.left), 0);
    const r = Math.max(gain(n.right), 0);
    best = Math.max(best, n.val + l + r);
    return n.val + Math.max(l, r);
  }
  gain(root);
  return best;
}`,
  },
];
