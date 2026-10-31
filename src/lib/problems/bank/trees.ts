import type { Problem } from "../types";

// Plain tree nodes for building the large tests and computing their answers.
interface TNode {
  val: number;
  left: TNode | null;
  right: TNode | null;
}

// Level order with nulls for missing children and trailing nulls trimmed, like the test driver.
function serialize(root: TNode | null): (number | null)[] {
  const out: (number | null)[] = [];
  const q: (TNode | null)[] = [root];
  for (let h = 0; h < q.length; h++) {
    const n = q[h];
    if (n) {
      out.push(n.val);
      q.push(n.left, n.right);
    } else out.push(null);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

function bstFrom(values: number[]): TNode | null {
  let root: TNode | null = null;
  for (const val of values) {
    const node: TNode = { val, left: null, right: null };
    if (!root) {
      root = node;
      continue;
    }
    let cur = root;
    for (;;) {
      if (val < cur.val) {
        if (!cur.left) {
          cur.left = node;
          break;
        }
        cur = cur.left;
      } else {
        if (!cur.right) {
          cur.right = node;
          break;
        }
        cur = cur.right;
      }
    }
  }
  return root;
}

const height = (n: TNode | null): number => (n ? 1 + Math.max(height(n.left), height(n.right)) : 0);

function bruteDiameter(n: TNode | null): number {
  if (!n) return 0;
  return Math.max(height(n.left) + height(n.right), bruteDiameter(n.left), bruteDiameter(n.right));
}

function bruteRightView(root: TNode | null): number[] {
  const view: number[] = [];
  const walk = (n: TNode | null, d: number) => {
    if (!n) return;
    view[d] = n.val; // left before right, so the rightmost node at each depth is written last
    walk(n.left, d + 1);
    walk(n.right, d + 1);
  };
  walk(root, 0);
  return view;
}

function inorder(n: TNode | null, out: number[] = []): number[] {
  if (n) {
    inorder(n.left, out);
    out.push(n.val);
    inorder(n.right, out);
  }
  return out;
}

function preorder(n: TNode | null, out: number[] = []): number[] {
  if (n) {
    out.push(n.val);
    preorder(n.left, out);
    preorder(n.right, out);
  }
  return out;
}

const isStrictlyIncreasing = (a: number[]) => a.every((x, i) => i === 0 || a[i - 1] < x);

// An irregular BST built from a scrambled insertion order (7919 is coprime with 1500).
const scrambledTree = bstFrom(Array.from({ length: 1500 }, (_, i) => (i * 7919) % 1500));
const scrambledLevels = serialize(scrambledTree);
// The same shape with one value swapped for another, which breaks the ordering.
const brokenLevels = (() => {
  const a = [...scrambledLevels];
  const i = a.indexOf(700), j = a.indexOf(800);
  [a[i], a[j]] = [a[j], a[i]];
  return a;
})();
const brokenTreeIsValid = (() => {
  // Rebuild the swapped tree to check it with the in-order test.
  const a = brokenLevels;
  const root: TNode = { val: a[0]!, left: null, right: null };
  const q = [root];
  let i = 1;
  for (let h = 0; h < q.length && i < a.length; h++) {
    const n = q[h];
    if (i < a.length && a[i] !== null) q.push((n.left = { val: a[i]!, left: null, right: null }));
    i++;
    if (i < a.length && a[i] !== null) q.push((n.right = { val: a[i]!, left: null, right: null }));
    i++;
  }
  return isStrictlyIncreasing(inorder(root));
})();
// Distinct values in a scrambled order give an irregular tree for the rebuild problem.
const rebuildTree = bstFrom(Array.from({ length: 1200 }, (_, i) => ((i * 7919) % 1200) - 600));
// Relabel so it is not a search tree (1201 is prime, so values stay distinct).
const relabel = (n: TNode | null): TNode | null =>
  n ? { val: (((n.val + 600) * 7) % 1201) - 600, left: relabel(n.left), right: relabel(n.right) } : null;
const plainTree = relabel(rebuildTree);

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
  {
    slug: "how-tall-is-the-tree",
    title: "How Tall Is the Tree",
    pattern: "trees",
    difficulty: "easy",
    rating: 900,
    statement: `Given the \`root\` of a binary tree, return its depth: the number of nodes on the longest path from the root down to a leaf. An empty tree has depth \`0\`.`,
    constraints: ["The tree has between 0 and 10^4 nodes", "-100 <= Node.val <= 100 (wider in the big test)"],
    hints: [
      "If you knew the depth of both subtrees, how would you get the depth of the whole tree?",
      "Depth is 0 for an empty tree, otherwise 1 + the larger depth of the two subtrees. A level-by-level BFS that counts levels works too.",
      "def depth(node):\n    if not node: return 0\n    return 1 + max(depth(node.left), depth(node.right))",
    ],
    complexity: { time: "O(n)", space: "O(h)" },
    signature: {
      kind: "function",
      name: "maxDepth",
      params: [{ name: "root", type: "TreeNode" }],
      returns: "int",
    },
    tests: [
      { input: [[3, 9, 20, null, null, 15, 7]], expected: 3, sample: true },
      { input: [[1, null, 2]], expected: 2, sample: true },
      { input: [[]], expected: 0, label: "empty tree" },
      { input: [[0]], expected: 1, label: "single node" },
      { input: [[1, 2, null, 3, null, 4]], expected: 4, label: "left-skewed tree" },
      { input: [[1, 2, 3, 4, 5, 6, 7]], expected: 3, label: "perfect tree" },
      { input: [[1, 2, 3, null, null, null, 4, null, 5]], expected: 4, label: "deep on the right" },
      { input: [[-1, -2, -3]], expected: 2, label: "negatives" },
      { input: [scrambledLevels], expected: height(scrambledTree), label: "large input" },
    ],
    companies: ["Amazon", "Microsoft", "Google", "Apple", "LinkedIn"],
    source: {
      name: "LeetCode 104. Maximum Depth of Binary Tree",
      url: "https://leetcode.com/problems/maximum-depth-of-binary-tree/",
    },
    reference: `function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}`,
  },
  {
    slug: "widest-span-in-a-tree",
    title: "Widest Span in a Tree",
    pattern: "trees",
    difficulty: "easy",
    rating: 1100,
    statement: `Given the \`root\` of a non-empty binary tree, return the length of the longest path between any two nodes, measured in **edges**. The path does not have to pass through the root.`,
    constraints: ["The tree has between 1 and 10^4 nodes", "-100 <= Node.val <= 100 (wider in the big test)"],
    hints: [
      "Every path has one highest node. What is the longest path whose highest node is a given node?",
      "For each node, the longest path bending there is height(left) + height(right). Compute heights bottom-up in one DFS and keep the best sum seen.",
      "best = 0\ndef h(node):\n    global best\n    if not node: return 0\n    l, r = h(node.left), h(node.right)\n    best = max(best, l + r)\n    return 1 + max(l, r)\nh(root)\nreturn best",
    ],
    complexity: { time: "O(n)", space: "O(h)" },
    signature: {
      kind: "function",
      name: "diameterOfBinaryTree",
      params: [{ name: "root", type: "TreeNode" }],
      returns: "int",
    },
    tests: [
      { input: [[1, 2, 3, 4, 5]], expected: 3, sample: true },
      { input: [[1, 2]], expected: 1, sample: true },
      { input: [[1]], expected: 0, label: "single node" },
      { input: [[1, 2, null, 3, null, 4]], expected: 3, label: "left-skewed tree" },
      { input: [[1, 2, 3, 4, 5, 6, 7]], expected: 4, label: "perfect tree" },
      {
        input: [[1, 2, null, 3, 4, 5, null, null, 6, 7, null, null, 8]],
        expected: 6,
        label: "longest path avoids the root",
      },
      { input: [[1, null, 2, null, 3]], expected: 2, label: "right-skewed tree" },
      { input: [[-5, -6, -7, -8]], expected: 3, label: "negatives" },
      { input: [scrambledLevels], expected: bruteDiameter(scrambledTree), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Google", "Microsoft"],
    source: { name: "LeetCode 543. Diameter of Binary Tree", url: "https://leetcode.com/problems/diameter-of-binary-tree/" },
    reference: `function diameterOfBinaryTree(root) {
  let best = 0;
  const h = (node) => {
    if (!node) return 0;
    const l = h(node.left), r = h(node.right);
    best = Math.max(best, l + r);
    return 1 + Math.max(l, r);
  };
  h(root);
  return best;
}`,
  },
  {
    slug: "view-from-the-right",
    title: "View From the Right",
    pattern: "trees",
    difficulty: "medium",
    rating: 1280,
    statement: `Imagine standing to the right of a binary tree and looking at it. At each depth you see exactly one node: the rightmost node on that level.

Given the \`root\`, return the values you can see, ordered from the top level to the bottom.`,
    constraints: ["The tree has between 0 and 100 nodes (more in the big test)", "-100 <= Node.val <= 100 (wider in the big test)"],
    hints: [
      "The visible node on a level is not always a right child. Think level by level.",
      "Do a BFS one level at a time and record the last node of each level. Or DFS visiting right before left, recording a node the first time you reach a new depth.",
      "res = []; level = [root] if root else []\nwhile level:\n    res.append(level[-1].val)\n    level = [c for n in level for c in (n.left, n.right) if c]\nreturn res",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "rightSideView",
      params: [{ name: "root", type: "TreeNode" }],
      returns: "int[]",
    },
    tests: [
      { input: [[1, 2, 3, null, 5, null, 4]], expected: [1, 3, 4], sample: true },
      { input: [[1, null, 3]], expected: [1, 3], sample: true },
      { input: [[]], expected: [], label: "empty tree" },
      { input: [[7]], expected: [7], label: "single node" },
      { input: [[1, 2, 3, 4]], expected: [1, 3, 4], label: "left subtree is deeper" },
      { input: [[1, 2, null, 3, null, 4]], expected: [1, 2, 3, 4], label: "left-skewed tree" },
      { input: [[1, 2, 3, null, 5, 6]], expected: [1, 3, 6], label: "hidden right child" },
      { input: [[1, 2, 3, 4, 5, 6, 7]], expected: [1, 3, 7], label: "perfect tree" },
      { input: [scrambledLevels], expected: bruteRightView(scrambledTree), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Bloomberg", "Microsoft"],
    source: { name: "LeetCode 199. Binary Tree Right Side View", url: "https://leetcode.com/problems/binary-tree-right-side-view/" },
    reference: `function rightSideView(root) {
  const res = [];
  let level = root ? [root] : [];
  while (level.length) {
    res.push(level[level.length - 1].val);
    const next = [];
    for (const n of level) {
      if (n.left) next.push(n.left);
      if (n.right) next.push(n.right);
    }
    level = next;
  }
  return res;
}`,
  },
  {
    slug: "is-it-a-search-tree",
    title: "Is It a Search Tree?",
    pattern: "trees",
    difficulty: "medium",
    rating: 1350,
    statement: `Given the \`root\` of a binary tree, decide whether it is a valid binary search tree:

- every value in a node's left subtree is strictly smaller than the node's value;
- every value in its right subtree is strictly larger;
- both subtrees are themselves valid binary search trees.

Return \`true\` or \`false\`.`,
    constraints: ["The tree has between 1 and 10^4 nodes", "-2^31 <= Node.val <= 2^31 - 1"],
    hints: [
      "Checking each node only against its direct children is not enough. A deep node must respect every ancestor.",
      "Pass down an allowed open interval (low, high). Going left tightens high to the node's value; going right tightens low. Alternatively, an in-order walk must be strictly increasing.",
      "def ok(node, lo, hi):\n    if not node: return True\n    if not (lo < node.val < hi): return False\n    return ok(node.left, lo, node.val) and ok(node.right, node.val, hi)\nreturn ok(root, -inf, inf)",
    ],
    complexity: { time: "O(n)", space: "O(h)" },
    signature: {
      kind: "function",
      name: "isValidBST",
      params: [{ name: "root", type: "TreeNode" }],
      returns: "bool",
    },
    tests: [
      { input: [[2, 1, 3]], expected: true, sample: true },
      { input: [[5, 1, 4, null, null, 3, 6]], expected: false, sample: true },
      { input: [[1]], expected: true, label: "single node" },
      { input: [[2, 2, 2]], expected: false, label: "equal values are not allowed" },
      { input: [[5, 4, 6, null, null, 3, 7]], expected: false, label: "violates a grandparent" },
      { input: [[1, null, 1]], expected: false, label: "equal right child" },
      { input: [[2147483647]], expected: true, label: "maximum value" },
      { input: [[-2147483648, null, 2147483647]], expected: true, label: "extreme values" },
      { input: [[10, 5, 15, null, null, 12, 20]], expected: true, label: "valid three levels" },
      { input: [scrambledLevels], expected: isStrictlyIncreasing(inorder(scrambledTree)), label: "large valid tree" },
      { input: [brokenLevels], expected: brokenTreeIsValid, label: "large tree with two values swapped" },
    ],
    companies: ["Amazon", "Meta", "Microsoft", "Bloomberg", "Google"],
    source: { name: "LeetCode 98. Validate Binary Search Tree", url: "https://leetcode.com/problems/validate-binary-search-tree/" },
    reference: `function isValidBST(root) {
  const ok = (node, lo, hi) => {
    if (!node) return true;
    if (node.val <= lo || node.val >= hi) return false;
    return ok(node.left, lo, node.val) && ok(node.right, node.val, hi);
  };
  return ok(root, -Infinity, Infinity);
}`,
  },
  {
    slug: "rebuild-from-two-walks",
    title: "Rebuild From Two Walks",
    pattern: "trees",
    difficulty: "medium",
    rating: 1500,
    statement: `A binary tree with **distinct** values was walked twice:

- \`preorder\` lists the values in pre-order (node, then left subtree, then right subtree);
- \`inorder\` lists them in in-order (left subtree, then node, then right subtree).

Rebuild the tree from these two lists and return its root.`,
    constraints: [
      "1 <= preorder.length <= 3000",
      "inorder.length == preorder.length",
      "-3000 <= values <= 3000, all distinct",
      "The two lists come from the same tree.",
    ],
    hints: [
      "The first value of preorder is always the root. Where does it sit in inorder, and what does that split tell you?",
      "Everything left of the root in inorder is the left subtree, everything right of it the right subtree. Recurse, consuming preorder from the front, and keep a value-to-index map of inorder so each split is O(1).",
      "idx = {v: i for i, v in enumerate(inorder)}; pos = 0\ndef build(lo, hi):\n    global pos\n    if lo > hi: return None\n    root = TreeNode(preorder[pos]); pos += 1\n    m = idx[root.val]\n    root.left = build(lo, m - 1)\n    root.right = build(m + 1, hi)\n    return root\nreturn build(0, len(inorder) - 1)",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "buildTree",
      params: [
        { name: "preorder", type: "int[]" },
        { name: "inorder", type: "int[]" },
      ],
      returns: "TreeNode",
    },
    tests: [
      { input: [[3, 9, 20, 15, 7], [9, 3, 15, 20, 7]], expected: [3, 9, 20, null, null, 15, 7], sample: true },
      { input: [[-1], [-1]], expected: [-1], sample: true },
      { input: [[1, 2], [2, 1]], expected: [1, 2], label: "left child only" },
      { input: [[1, 2], [1, 2]], expected: [1, null, 2], label: "right child only" },
      { input: [[1, 2, 3], [3, 2, 1]], expected: [1, 2, null, 3], label: "left-skewed tree" },
      { input: [[1, 2, 4, 5, 3, 6, 7], [4, 2, 5, 1, 6, 3, 7]], expected: [1, 2, 3, 4, 5, 6, 7], label: "perfect tree" },
      { input: [[4, 1, 2, 3], [1, 2, 3, 4]], expected: [4, 1, null, null, 2, null, 3], label: "zigzag shape" },
      { input: [[0, -5, 5], [-5, 0, 5]], expected: [0, -5, 5], label: "negatives" },
      { input: [preorder(plainTree), inorder(plainTree)], expected: serialize(plainTree), label: "large input" },
    ],
    companies: ["Amazon", "Microsoft", "Google", "Bloomberg", "Meta"],
    source: {
      name: "LeetCode 105. Construct Binary Tree from Preorder and Inorder Traversal",
      url: "https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/",
    },
    reference: `function buildTree(preorder, inorder) {
  const idx = new Map(inorder.map((v, i) => [v, i]));
  let pos = 0;
  const build = (lo, hi) => {
    if (lo > hi) return null;
    const root = new TreeNode(preorder[pos++]);
    const m = idx.get(root.val);
    root.left = build(lo, m - 1);
    root.right = build(m + 1, hi);
    return root;
  };
  return build(0, inorder.length - 1);
}`,
  },
];
