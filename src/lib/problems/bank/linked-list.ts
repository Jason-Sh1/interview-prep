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

const mergeSorted = (a: number[], b: number[]) => [...a, ...b].sort((x, y) => x - y);
const withoutNthFromEnd = (a: number[], n: number) => a.filter((_, i) => i !== a.length - n);

// Digits are stored least significant first; add them like long addition.
function bruteAddDigits(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let carry = 0;
  for (let i = 0; i < Math.max(a.length, b.length) || carry; i++) {
    const s = (a[i] ?? 0) + (b[i] ?? 0) + carry;
    out.push(s % 10);
    carry = Math.floor(s / 10);
  }
  return out;
}

const bigDigitsA = Array.from({ length: 1500 }, (_, i) => (i * 7 + 3) % 10);
const bigDigitsB = Array.from({ length: 1200 }, (_, i) => (i * i + 9) % 10);
const sortedRunA = Array.from({ length: 1500 }, (_, i) => 3 * i - 2000);
const sortedRunB = Array.from({ length: 1000 }, (_, i) => 4 * i - 1500);

// A long LRU session simulated with a plain array (most recent at the end).
const cacheLog = (() => {
  const capacity = 20;
  const ops: string[] = ["LRUCache"];
  const args: number[][] = [[capacity]];
  const expected: (number | null)[] = [null];
  let order: [number, number][] = [];
  for (let i = 0; i < 1500; i++) {
    const key = (i * 7919) % 37;
    const at = order.findIndex(([k]) => k === key);
    if (i % 3 === 0) {
      ops.push("get");
      args.push([key]);
      if (at === -1) expected.push(-1);
      else {
        const entry = order[at];
        order = [...order.slice(0, at), ...order.slice(at + 1), entry];
        expected.push(entry[1]);
      }
    } else {
      const value = (i * 31) % 1000;
      ops.push("put");
      args.push([key, value]);
      expected.push(null);
      if (at !== -1) order.splice(at, 1);
      order.push([key, value]);
      if (order.length > capacity) order.shift();
    }
  }
  return { input: [ops, args], expected };
})();

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
  {
    slug: "halfway-node",
    title: "Halfway Node",
    pattern: "linked-list",
    difficulty: "easy",
    rating: 900,
    statement: `Given the \`head\` of a non-empty singly linked list, return the list starting from its middle node. If the list has an even number of nodes, there are two middle nodes; return the list starting from the **second** one.`,
    constraints: ["1 <= number of nodes <= 100 (larger in the big test)", "1 <= Node.val <= 100"],
    hints: [
      "Counting the nodes first and walking again works. Can you find the middle in one pass?",
      "Move a slow pointer one step and a fast pointer two steps at a time. When fast reaches the end, slow is at the middle.",
      "slow = fast = head\nwhile fast and fast.next:\n    slow = slow.next\n    fast = fast.next.next\nreturn slow",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "middleNode",
      params: [{ name: "head", type: "ListNode" }],
      returns: "ListNode",
    },
    tests: [
      { input: [[1, 2, 3, 4, 5]], expected: [3, 4, 5], sample: true },
      { input: [[1, 2, 3, 4, 5, 6]], expected: [4, 5, 6], sample: true },
      { input: [[7]], expected: [7], label: "single node" },
      { input: [[1, 2]], expected: [2], label: "two nodes" },
      { input: [[1, 2, 3]], expected: [2, 3], label: "three nodes" },
      { input: [[5, 5, 5, 5]], expected: [5, 5], label: "all same" },
      { input: [[9, 8, 7, 6, 5, 4, 3]], expected: [6, 5, 4, 3], label: "odd length" },
      { input: [range(2001)], expected: range(2001).slice(1000), label: "large input" },
    ],
    companies: ["Amazon", "Microsoft", "Apple", "Adobe"],
    source: { name: "LeetCode 876. Middle of the Linked List", url: "https://leetcode.com/problems/middle-of-the-linked-list/" },
    reference: `function middleNode(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  return slow;
}`,
  },
  {
    slug: "zip-two-sorted-chains",
    title: "Zip Two Sorted Chains",
    pattern: "linked-list",
    difficulty: "easy",
    rating: 1000,
    statement: `You are given the heads of two singly linked lists, \`list1\` and \`list2\`, each sorted in non-decreasing order. Splice their nodes together into one sorted list and return its head. Reuse the existing nodes rather than creating new ones.`,
    constraints: ["0 <= number of nodes in each list <= 50 (larger in the big test)", "-100 <= Node.val <= 100", "Both lists are sorted in non-decreasing order."],
    hints: [
      "At every step, the next node of the result is the smaller of the two current heads.",
      "Use a dummy node and a tail pointer. Repeatedly attach the smaller head to the tail and advance that list. When one list runs out, attach the rest of the other.",
      "dummy = tail = ListNode()\nwhile list1 and list2:\n    if list1.val <= list2.val: tail.next, list1 = list1, list1.next\n    else: tail.next, list2 = list2, list2.next\n    tail = tail.next\ntail.next = list1 or list2\nreturn dummy.next",
    ],
    complexity: { time: "O(n + m)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "mergeTwoLists",
      params: [
        { name: "list1", type: "ListNode" },
        { name: "list2", type: "ListNode" },
      ],
      returns: "ListNode",
    },
    tests: [
      { input: [[1, 2, 4], [1, 3, 4]], expected: [1, 1, 2, 3, 4, 4], sample: true },
      { input: [[], [0]], expected: [0], sample: true },
      { input: [[], []], expected: [], label: "both empty" },
      { input: [[2, 5], []], expected: [2, 5], label: "second empty" },
      { input: [[1, 2, 3], [4, 5, 6]], expected: [1, 2, 3, 4, 5, 6], label: "no overlap" },
      { input: [[5], [1, 2, 3]], expected: [1, 2, 3, 5], label: "one long, one short" },
      { input: [[-3, 0, 0], [-3, 0]], expected: [-3, -3, 0, 0, 0], label: "duplicates and negatives" },
      { input: [[1, 3, 5, 7], [2, 4, 6, 8]], expected: [1, 2, 3, 4, 5, 6, 7, 8], label: "perfect interleave" },
      { input: [sortedRunA, sortedRunB], expected: mergeSorted(sortedRunA, sortedRunB), label: "large input" },
    ],
    companies: ["Amazon", "Microsoft", "Apple", "Meta", "Google"],
    source: { name: "LeetCode 21. Merge Two Sorted Lists", url: "https://leetcode.com/problems/merge-two-sorted-lists/" },
    reference: `function mergeTwoLists(list1, list2) {
  const dummy = new ListNode(0);
  let tail = dummy;
  while (list1 && list2) {
    if (list1.val <= list2.val) {
      tail.next = list1;
      list1 = list1.next;
    } else {
      tail.next = list2;
      list2 = list2.next;
    }
    tail = tail.next;
  }
  tail.next = list1 || list2;
  return dummy.next;
}`,
  },
  {
    slug: "drop-the-nth-from-the-back",
    title: "Drop the Nth From the Back",
    pattern: "linked-list",
    difficulty: "medium",
    rating: 1250,
    statement: `Given the \`head\` of a singly linked list and an integer \`n\`, remove the \`n\`-th node counting from the end of the list (\`n = 1\` is the last node) and return the head of the resulting list.

*Follow-up:* can you do it in a single pass?`,
    constraints: ["1 <= number of nodes (sz) <= 30 (larger in the big test)", "0 <= Node.val <= 100", "1 <= n <= sz"],
    hints: [
      "If one pointer is n nodes ahead of another, where is the trailing pointer when the leading one falls off the end?",
      "Start both pointers at a dummy node placed before head. Advance the lead pointer n + 1 steps, then move both until the lead is null. The trailing pointer is now just before the node to remove.",
      "dummy = ListNode(0, head); lead = trail = dummy\nfor _ in range(n + 1): lead = lead.next\nwhile lead:\n    lead, trail = lead.next, trail.next\ntrail.next = trail.next.next\nreturn dummy.next",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "removeNthFromEnd",
      params: [
        { name: "head", type: "ListNode" },
        { name: "n", type: "int" },
      ],
      returns: "ListNode",
    },
    tests: [
      { input: [[1, 2, 3, 4, 5], 2], expected: [1, 2, 3, 5], sample: true },
      { input: [[1], 1], expected: [], sample: true },
      { input: [[1, 2], 1], expected: [1], label: "remove the last node" },
      { input: [[1, 2], 2], expected: [2], label: "remove the head" },
      { input: [[1, 2, 3, 4, 5], 5], expected: [2, 3, 4, 5], label: "remove the head of a long list" },
      { input: [[1, 2, 3], 2], expected: [1, 3], label: "remove the middle" },
      { input: [[7, 7, 7, 7], 3], expected: [7, 7, 7], label: "all same" },
      { input: [[0, 10, 20, 30, 40, 50], 1], expected: [0, 10, 20, 30, 40], label: "last of six" },
      { input: [range(2000), 777], expected: withoutNthFromEnd(range(2000), 777), label: "large input" },
    ],
    companies: ["Meta", "Amazon", "Microsoft", "Google", "Apple"],
    source: {
      name: "LeetCode 19. Remove Nth Node From End of List",
      url: "https://leetcode.com/problems/remove-nth-node-from-end-of-list/",
    },
    reference: `function removeNthFromEnd(head, n) {
  const dummy = new ListNode(0, head);
  let lead = dummy, trail = dummy;
  for (let i = 0; i <= n; i++) lead = lead.next;
  while (lead) {
    lead = lead.next;
    trail = trail.next;
  }
  trail.next = trail.next.next;
  return dummy.next;
}`,
  },
  {
    slug: "digit-chain-sum",
    title: "Digit Chain Sum",
    pattern: "linked-list",
    difficulty: "medium",
    rating: 1300,
    statement: `Two non-negative integers are stored as linked lists of digits, **least significant digit first**: the number 342 is stored as \`2 -> 4 -> 3\`. Neither number has leading zeros, except the number 0 itself.

Given the heads \`l1\` and \`l2\`, return their sum as a linked list in the same format. The numbers can be far too long to fit in any built-in integer type.`,
    constraints: ["1 <= number of nodes in each list <= 100 (larger in the big test)", "0 <= Node.val <= 9", "No leading zeros except for the number 0."],
    hints: [
      "The lists are already in the order you would add digits by hand: ones, tens, hundreds...",
      "Walk both lists together with a carry. Each step adds the two digits (0 if a list has ended) plus the carry, outputs the sum mod 10 and carries the rest. Do not forget a final carry.",
      "dummy = tail = ListNode(); carry = 0\nwhile l1 or l2 or carry:\n    s = carry + (l1.val if l1 else 0) + (l2.val if l2 else 0)\n    tail.next = ListNode(s % 10); tail = tail.next\n    carry = s // 10\n    l1 = l1.next if l1 else None\n    l2 = l2.next if l2 else None\nreturn dummy.next",
    ],
    complexity: { time: "O(max(m, n))", space: "O(max(m, n))" },
    signature: {
      kind: "function",
      name: "addTwoNumbers",
      params: [
        { name: "l1", type: "ListNode" },
        { name: "l2", type: "ListNode" },
      ],
      returns: "ListNode",
    },
    tests: [
      { input: [[2, 4, 3], [5, 6, 4]], expected: [7, 0, 8], sample: true },
      { input: [[0], [0]], expected: [0], sample: true },
      { input: [[9, 9, 9, 9, 9, 9, 9], [9, 9, 9, 9]], expected: [8, 9, 9, 9, 0, 0, 0, 1], label: "carry runs off the end" },
      { input: [[5], [5]], expected: [0, 1], label: "single digits with carry" },
      { input: [[1, 8], [0]], expected: [1, 8], label: "adding zero" },
      { input: [[1], [9, 9, 9]], expected: [0, 0, 0, 1], label: "different lengths" },
      { input: [[3, 2, 1], [1, 2, 3]], expected: [4, 4, 4], label: "no carries" },
      { input: [[9], [1, 9, 9, 9, 8]], expected: [0, 0, 0, 0, 9], label: "carry chain into a long list" },
      { input: [bigDigitsA, bigDigitsB], expected: bruteAddDigits(bigDigitsA, bigDigitsB), label: "large input" },
    ],
    companies: ["Amazon", "Microsoft", "Meta", "Bloomberg", "Adobe"],
    source: { name: "LeetCode 2. Add Two Numbers", url: "https://leetcode.com/problems/add-two-numbers/" },
    reference: `function addTwoNumbers(l1, l2) {
  const dummy = new ListNode(0);
  let tail = dummy, carry = 0;
  while (l1 || l2 || carry) {
    const s = carry + (l1 ? l1.val : 0) + (l2 ? l2.val : 0);
    tail.next = new ListNode(s % 10);
    tail = tail.next;
    carry = Math.floor(s / 10);
    l1 = l1 ? l1.next : null;
    l2 = l2 ? l2.next : null;
  }
  return dummy.next;
}`,
  },
  {
    slug: "recently-used-cache",
    title: "Recently Used Cache",
    pattern: "linked-list",
    difficulty: "medium",
    rating: 1500,
    statement: `Design a class \`LRUCache\`, a key-value cache with a fixed capacity that throws away the *least recently used* entry when it overflows.

- \`LRUCache(capacity)\` creates an empty cache holding at most \`capacity\` entries.
- \`get(key)\` returns the value stored for \`key\`, or \`-1\` if it is absent. A successful get counts as a use.
- \`put(key, value)\` stores \`value\` for \`key\` (replacing any old value), which counts as a use. If this pushes the cache over capacity, first remove the entry that was used least recently.

Both operations must run in O(1) average time.`,
    constraints: [
      "1 <= capacity <= 3000",
      "0 <= key <= 10^4; 0 <= value <= 10^5",
      "At most 2 * 10^5 calls to get and put.",
    ],
    hints: [
      "You need O(1) lookup by key and O(1) \"move this entry to the most-recent end\" and \"drop the least-recent entry\".",
      "Combine a hash map from key to node with a doubly linked list ordered by recency (dummy head and tail make the edge cases disappear). On every use, unlink the node and re-insert it next to the head; evict from the tail.",
      "get(k): if k not in m: return -1\n    node = m[k]; unlink(node); push_front(node); return node.val\nput(k, v):\n    if k in m: unlink(m[k])\n    node = Node(k, v); m[k] = node; push_front(node)\n    if len(m) > cap:\n        lru = tail.prev; unlink(lru); del m[lru.key]",
    ],
    complexity: { time: "O(1)", space: "O(n)" },
    signature: {
      kind: "design",
      className: "LRUCache",
      constructorParams: [{ name: "capacity", type: "int" }],
      methods: [
        { name: "get", params: [{ name: "key", type: "int" }], returns: "int" },
        {
          name: "put",
          params: [
            { name: "key", type: "int" },
            { name: "value", type: "int" },
          ],
          returns: "void",
        },
      ],
    },
    tests: [
      {
        input: [
          ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"],
          [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]],
        ],
        expected: [null, null, null, 1, null, -1, null, -1, 3, 4],
        sample: true,
      },
      {
        input: [
          ["LRUCache", "put", "get", "put", "get", "get"],
          [[1], [2, 1], [2], [3, 2], [2], [3]],
        ],
        expected: [null, null, 1, null, -1, 2],
        sample: true,
      },
      {
        input: [["LRUCache", "get"], [[3], [7]]],
        expected: [null, -1],
        label: "empty cache",
      },
      {
        input: [
          ["LRUCache", "put", "put", "get"],
          [[2], [1, 1], [1, 9], [1]],
        ],
        expected: [null, null, null, 9],
        label: "overwrite a key",
      },
      {
        input: [
          ["LRUCache", "put", "put", "put", "put", "get", "get"],
          [[2], [2, 1], [1, 1], [2, 3], [4, 1], [1], [2]],
        ],
        expected: [null, null, null, null, null, -1, 3],
        label: "overwrite refreshes recency",
      },
      {
        input: [
          ["LRUCache", "put", "put", "get", "put", "get", "get"],
          [[2], [1, 1], [2, 2], [1], [3, 3], [1], [2]],
        ],
        expected: [null, null, null, 1, null, 1, -1],
        label: "get refreshes recency",
      },
      {
        input: [
          ["LRUCache", "put", "put", "put", "get", "get", "get"],
          [[3], [0, 0], [1, 10], [2, 20], [0], [1], [2]],
        ],
        expected: [null, null, null, null, 0, 10, 20],
        label: "exactly at capacity",
      },
      { input: cacheLog.input, expected: cacheLog.expected, label: "long session" },
    ],
    companies: ["Amazon", "Microsoft", "Meta", "Google", "Bloomberg", "Uber"],
    source: { name: "LeetCode 146. LRU Cache", url: "https://leetcode.com/problems/lru-cache/" },
    reference: `class LRUCache {
  constructor(capacity) {
    this.cap = capacity;
    this.map = new Map();
    this.head = { prev: null, next: null };
    this.tail = { prev: this.head, next: null };
    this.head.next = this.tail;
  }
  unlink(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }
  pushFront(node) {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next.prev = node;
    this.head.next = node;
  }
  get(key) {
    const node = this.map.get(key);
    if (!node) return -1;
    this.unlink(node);
    this.pushFront(node);
    return node.val;
  }
  put(key, value) {
    const old = this.map.get(key);
    if (old) this.unlink(old);
    const node = { key, val: value, prev: null, next: null };
    this.map.set(key, node);
    this.pushFront(node);
    if (this.map.size > this.cap) {
      const lru = this.tail.prev;
      this.unlink(lru);
      this.map.delete(lru.key);
    }
  }
}`,
  },
];
