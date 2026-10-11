import type { Problem } from "../types";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function interleaveEnds(a: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = a.length - 1;
  while (i <= j) {
    out.push(a[i++]);
    if (i <= j) out.push(a[j--]);
  }
  return out;
}

function reverseChunks(a: number[], k: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < a.length; i += k) {
    const chunk = a.slice(i, i + k);
    out.push(...(chunk.length === k ? chunk.reverse() : chunk));
  }
  return out;
}

export const linkedList: Problem[] = [
  {
    slug: "flip-the-chain",
    title: "Flip the Chain",
    pattern: "linked-list",
    difficulty: "easy",
    rating: 950,
    statement: `You are given the \`head\` of a singly linked list. Reverse the direction of every link so the last node becomes the first, and return the new head.

*Follow-up:* write both an iterative and a recursive version.`,
    constraints: ["0 <= number of nodes <= 5000", "-5000 <= Node.val <= 5000"],
    hints: [
      "As you walk the list, each node's next pointer should end up pointing to the node before it.",
      "Keep prev (initially null) and curr. Save curr.next, point curr.next at prev, then advance both. prev is the new head at the end.",
      "prev, curr = None, head\nwhile curr:\n    nxt = curr.next\n    curr.next = prev\n    prev, curr = curr, nxt\nreturn prev",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "reverseList",
      params: [{ name: "head", type: "ListNode" }],
      returns: "ListNode",
    },
    tests: [
      { input: [[1, 2, 3, 4, 5]], expected: [5, 4, 3, 2, 1], sample: true },
      { input: [[1, 2]], expected: [2, 1], sample: true },
      { input: [[]], expected: [], label: "empty list" },
      { input: [[7]], expected: [7], label: "single node" },
      { input: [[1, 1, 2]], expected: [2, 1, 1], label: "duplicates" },
      { input: [[-3, 0, 3]], expected: [3, 0, -3], label: "negatives" },
      { input: [[4, 4, 4]], expected: [4, 4, 4], label: "all same" },
      { input: [range(2000)], expected: range(2000).reverse(), label: "large input" },
    ],
    companies: ["Amazon", "Microsoft", "Apple", "Meta", "Google"],
    source: { name: "LeetCode 206. Reverse Linked List", url: "https://leetcode.com/problems/reverse-linked-list/" },
    reference: `function reverseList(head) {
  let prev = null, curr = head;
  while (curr) {
    const nxt = curr.next;
    curr.next = prev;
    prev = curr;
    curr = nxt;
  }
  return prev;
}`,
  },
  {
    slug: "zigzag-the-chain",
    title: "Zigzag the Chain",
    pattern: "linked-list",
    difficulty: "medium",
    rating: 1400,
    statement: `You are given the \`head\` of a singly linked list whose nodes, in order, are \`L0, L1, L2, ..., Ln\`. Rearrange the nodes so the list reads

\`L0, Ln, L1, Ln-1, L2, Ln-2, ...\`

taking alternately from the front and the back. Rewire the existing nodes (do not just change their values) and modify the list in place; the function returns nothing.`,
    constraints: ["0 <= number of nodes <= 5 * 10^4", "1 <= Node.val <= 1000"],
    hints: [
      "The back half of the list is needed in reverse order. Which three simpler list operations combine into this one?",
      "Find the middle with slow/fast pointers, cut the list there, reverse the second half, then merge the two halves by alternating nodes.",
      "slow = fast = head\nwhile fast.next and fast.next.next: slow, fast = slow.next, fast.next.next\nsecond = reverse(slow.next); slow.next = None\nfirst = head\nwhile second:\n    a, b = first.next, second.next\n    first.next = second; second.next = a\n    first, second = a, b",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "reorderList",
      params: [{ name: "head", type: "ListNode" }],
      returns: "void",
      inPlaceArg: 0,
    },
    tests: [
      { input: [[1, 2, 3, 4]], expected: [1, 4, 2, 3], sample: true },
      { input: [[1, 2, 3, 4, 5]], expected: [1, 5, 2, 4, 3], sample: true },
      { input: [[]], expected: [], label: "empty list" },
      { input: [[1]], expected: [1], label: "single node" },
      { input: [[1, 2]], expected: [1, 2], label: "two nodes" },
      { input: [[1, 2, 3]], expected: [1, 3, 2], label: "three nodes" },
      { input: [[5, 5, 5, 5]], expected: [5, 5, 5, 5], label: "all same" },
      { input: [[9, 8, 7, 6, 5, 4]], expected: [9, 4, 8, 5, 7, 6], label: "decreasing values" },
      {
        input: [range(1001).map((x) => x + 1)],
        expected: interleaveEnds(range(1001).map((x) => x + 1)),
        label: "large input",
      },
    ],
    companies: ["Amazon", "Meta", "Microsoft", "Bloomberg"],
    source: { name: "LeetCode 143. Reorder List", url: "https://leetcode.com/problems/reorder-list/" },
    reference: `function reorderList(head) {
  if (!head || !head.next) return;
  let slow = head, fast = head;
  while (fast.next && fast.next.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  let prev = null, curr = slow.next;
  slow.next = null;
  while (curr) {
    const nxt = curr.next;
    curr.next = prev;
    prev = curr;
    curr = nxt;
  }
  let first = head, second = prev;
  while (second) {
    const a = first.next, b = second.next;
    first.next = second;
    second.next = a;
    first = a;
    second = b;
  }
}`,
  },
  {
    slug: "flip-in-blocks",
    title: "Flip in Blocks",
    pattern: "linked-list",
    difficulty: "hard",
    rating: 1750,
    statement: `You are given the \`head\` of a singly linked list and a positive integer \`k\`. Walk the list in consecutive blocks of \`k\` nodes and reverse the nodes inside each full block. If the final block has fewer than \`k\` nodes, leave it in its original order.

Rewire the nodes themselves (do not only swap values) and return the head of the resulting list. Try to use O(1) extra memory.`,
    constraints: ["1 <= number of nodes <= 5000", "1 <= k <= number of nodes", "0 <= Node.val <= 1000"],
    hints: [
      "Before reversing a block, confirm that k nodes actually remain.",
      "Use a dummy node before the head. For each block: find its k-th node, reverse the block in place, then connect the node before the block to the new block head and the old block head (now its tail) to whatever follows.",
      "dummy = ListNode(0, head); before = dummy\nwhile True:\n    kth = before\n    for _ in range(k):\n        kth = kth.next\n        if not kth: return dummy.next\n    after = kth.next\n    prev, curr = after, before.next\n    while curr != after:\n        curr.next, prev, curr = prev, curr, curr.next\n    tail = before.next; before.next = kth; before = tail",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "reverseKGroup",
      params: [
        { name: "head", type: "ListNode" },
        { name: "k", type: "int" },
      ],
      returns: "ListNode",
    },
    tests: [
      { input: [[1, 2, 3, 4, 5], 2], expected: [2, 1, 4, 3, 5], sample: true },
      { input: [[1, 2, 3, 4, 5], 3], expected: [3, 2, 1, 4, 5], sample: true },
      { input: [[1, 2, 3, 4, 5], 1], expected: [1, 2, 3, 4, 5], label: "k = 1" },
      { input: [[1], 1], expected: [1], label: "single node" },
      { input: [[1, 2], 2], expected: [2, 1], label: "k equals length" },
      { input: [[1, 2, 3, 4, 5, 6], 3], expected: [3, 2, 1, 6, 5, 4], label: "exact multiple" },
      { input: [[7, 7, 8, 8], 2], expected: [7, 7, 8, 8], label: "duplicates" },
      { input: [[0, 1, 2, 3, 4, 5, 6], 4], expected: [3, 2, 1, 0, 4, 5, 6], label: "leftover block" },
      { input: [range(2000), 7], expected: reverseChunks(range(2000), 7), label: "large input" },
    ],
    companies: ["Microsoft", "Amazon", "Meta", "Google"],
    source: {
      name: "LeetCode 25. Reverse Nodes in k-Group",
      url: "https://leetcode.com/problems/reverse-nodes-in-k-group/",
    },
    reference: `function reverseKGroup(head, k) {
  const dummy = new ListNode(0, head);
  let before = dummy;
  while (true) {
    let kth = before;
    for (let i = 0; i < k; i++) {
      kth = kth.next;
      if (!kth) return dummy.next;
    }
    const after = kth.next;
    let prev = after, curr = before.next;
    while (curr !== after) {
      const nxt = curr.next;
      curr.next = prev;
      prev = curr;
      curr = nxt;
    }
    const tail = before.next;
    before.next = kth;
    before = tail;
  }
}`,
  },
];
