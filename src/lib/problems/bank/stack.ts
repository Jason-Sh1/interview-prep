import type { Problem } from "../types";

const bigBars = Array.from({ length: 1500 }, (_, i) => (i * 131 + 17) % 200);

function bruteLargestRectangle(h: number[]): number {
  let best = 0;
  for (let i = 0; i < h.length; i++) {
    let low = Infinity;
    for (let j = i; j < h.length; j++) {
      low = Math.min(low, h[j]);
      best = Math.max(best, low * (j - i + 1));
    }
  }
  return best;
}

export const stack: Problem[] = [
  {
    slug: "balanced-brackets",
    title: "Balanced Brackets",
    pattern: "stack",
    difficulty: "easy",
    rating: 950,
    statement: `A string \`s\` contains only the characters \`(\`, \`)\`, \`[\`, \`]\`, \`{\` and \`}\`. It is *balanced* when every opening bracket is closed by a bracket of the same kind, brackets close in the reverse order they were opened, and no closing bracket appears without a matching opener.

Return \`true\` if \`s\` is balanced and \`false\` otherwise. The empty string is balanced.`,
    constraints: ["0 <= s.length <= 10^4", "s consists only of the characters ()[]{}"],
    hints: [
      "The bracket that must close next is always the most recently opened one that is still open.",
      "Push opening brackets on a stack. On a closing bracket, the stack top must be its matching opener; pop it. At the end the stack must be empty.",
      "pairs = {')': '(', ']': '[', '}': '{'}\nst = []\nfor c in s:\n    if c in pairs:\n        if not st or st.pop() != pairs[c]: return False\n    else: st.append(c)\nreturn not st",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "isValid",
      params: [{ name: "s", type: "string" }],
      returns: "bool",
    },
    tests: [
      { input: ["()[]{}"], expected: true, sample: true },
      { input: ["(]"], expected: false, sample: true },
      { input: [""], expected: true, label: "empty string" },
      { input: ["(("], expected: false, label: "unclosed openers" },
      { input: ["))"], expected: false, label: "closer with empty stack" },
      { input: ["([)]"], expected: false, label: "crossed pairs" },
      { input: ["{[]}"], expected: true, label: "nested" },
      { input: ["["], expected: false, label: "single character" },
      { input: ["({[".repeat(1000) + "]})".repeat(1000)], expected: true, label: "large nested" },
    ],
    companies: ["Amazon", "Google", "Meta", "Microsoft", "Bloomberg"],
    source: { name: "LeetCode 20. Valid Parentheses", url: "https://leetcode.com/problems/valid-parentheses/" },
    reference: `function isValid(s) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const st = [];
  for (const c of s) {
    if (pairs[c]) {
      if (!st.length || st.pop() !== pairs[c]) return false;
    } else st.push(c);
  }
  return st.length === 0;
}`,
  },
  {
    slug: "stack-with-minimum",
    title: "Stack With Minimum",
    pattern: "stack",
    difficulty: "medium",
    rating: 1250,
    statement: `Design a class \`MinStack\`, a stack of integers that can also report its smallest element. Every operation must run in O(1) time.

- \`MinStack()\` creates an empty stack.
- \`push(val)\` places \`val\` on top.
- \`pop()\` removes the top element.
- \`top()\` returns the top element without removing it.
- \`getMin()\` returns the smallest element currently in the stack.

\`pop\`, \`top\` and \`getMin\` are only called when the stack is non-empty.`,
    constraints: [
      "-2^31 <= val <= 2^31 - 1",
      "pop, top and getMin are called only on a non-empty stack.",
      "At most 3 * 10^4 calls in total.",
    ],
    hints: [
      "When the current minimum is popped, you need to know what the minimum was before it was pushed.",
      "Store, alongside each element, the minimum of the stack at the moment it was pushed (or keep a second stack of minimums).",
      "push(v): st.append((v, min(v, st[-1][1]) if st else v))\npop(): st.pop()\ntop(): return st[-1][0]\ngetMin(): return st[-1][1]",
    ],
    complexity: { time: "O(1)", space: "O(n)" },
    signature: {
      kind: "design",
      className: "MinStack",
      constructorParams: [],
      methods: [
        { name: "push", params: [{ name: "val", type: "int" }], returns: "void" },
        { name: "pop", params: [], returns: "void" },
        { name: "top", params: [], returns: "int" },
        { name: "getMin", params: [], returns: "int" },
      ],
    },
    tests: [
      {
        input: [
          ["MinStack", "push", "push", "push", "getMin", "pop", "top", "getMin"],
          [[], [-2], [0], [-3], [], [], [], []],
        ],
        expected: [null, null, null, null, -3, null, 0, -2],
        sample: true,
      },
      {
        input: [
          ["MinStack", "push", "push", "getMin", "top", "pop", "getMin"],
          [[], [5], [3], [], [], [], []],
        ],
        expected: [null, null, null, 3, 3, null, 5],
        sample: true,
      },
      {
        input: [["MinStack", "push", "top", "getMin"], [[], [7], [], []]],
        expected: [null, null, 7, 7],
        label: "single element",
      },
      {
        input: [
          ["MinStack", "push", "push", "push", "pop", "getMin", "pop", "getMin"],
          [[], [1], [1], [1], [], [], [], []],
        ],
        expected: [null, null, null, null, null, 1, null, 1],
        label: "duplicate minimums",
      },
      {
        input: [
          ["MinStack", "push", "push", "push", "getMin", "pop", "getMin", "pop", "getMin"],
          [[], [3], [2], [1], [], [], [], [], []],
        ],
        expected: [null, null, null, null, 1, null, 2, null, 3],
        label: "decreasing pushes",
      },
      {
        input: [
          ["MinStack", "push", "push", "pop", "push", "getMin", "top"],
          [[], [-2147483648], [2147483647], [], [0], [], []],
        ],
        expected: [null, null, null, null, null, -2147483648, 0],
        label: "extreme values",
      },
      {
        input: [
          ["MinStack", "push", "pop", "push", "getMin", "push", "getMin"],
          [[], [4], [], [9], [], [6], []],
        ],
        expected: [null, null, null, null, 9, null, 6],
        label: "reuse after emptying",
      },
    ],
    companies: ["Amazon", "Bloomberg", "Microsoft", "Google"],
    source: { name: "LeetCode 155. Min Stack", url: "https://leetcode.com/problems/min-stack/" },
    reference: `class MinStack {
  constructor() {
    this.vals = [];
    this.mins = [];
  }
  push(val) {
    this.vals.push(val);
    const m = this.mins.length ? Math.min(val, this.mins[this.mins.length - 1]) : val;
    this.mins.push(m);
  }
  pop() {
    this.vals.pop();
    this.mins.pop();
  }
  top() {
    return this.vals[this.vals.length - 1];
  }
  getMin() {
    return this.mins[this.mins.length - 1];
  }
}`,
  },
  {
    slug: "biggest-skyline-block",
    title: "Biggest Skyline Block",
    pattern: "stack",
    difficulty: "hard",
    rating: 1750,
    statement: `A skyline is drawn as adjacent bars of width 1; bar \`i\` has height \`heights[i]\`. You want to paint one axis-aligned rectangle that lies entirely inside the bars (it may span several neighboring bars, but it can be no taller than the shortest bar it covers).

Return the largest area such a rectangle can have.`,
    constraints: ["1 <= heights.length <= 10^5", "0 <= heights[i] <= 10^4"],
    hints: [
      "For each bar, imagine the widest rectangle whose height is exactly that bar's height. How far can it extend left and right?",
      "Keep a stack of indices with increasing heights. When a shorter bar arrives, pop taller bars: each popped bar's rectangle ends here and starts just after the new stack top.",
      "st = []; best = 0\nfor i, h in enumerate(heights + [0]):\n    while st and heights[st[-1]] >= h:\n        top = st.pop()\n        left = st[-1] + 1 if st else 0\n        best = max(best, heights[top] * (i - left))\n    st.append(i)\nreturn best",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "largestRectangleArea",
      params: [{ name: "heights", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[2, 1, 5, 6, 2, 3]], expected: 10, sample: true },
      { input: [[2, 4]], expected: 4, sample: true },
      { input: [[5]], expected: 5, label: "single bar" },
      { input: [[0]], expected: 0, label: "zero height" },
      { input: [[3, 3, 3]], expected: 9, label: "all same" },
      { input: [[1, 2, 3, 4, 5]], expected: 9, label: "increasing" },
      { input: [[5, 4, 3, 2, 1]], expected: 9, label: "decreasing" },
      { input: [[2, 1, 2]], expected: 3, label: "valley" },
      { input: [bigBars], expected: bruteLargestRectangle(bigBars), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Microsoft", "Meta"],
    source: {
      name: "LeetCode 84. Largest Rectangle in Histogram",
      url: "https://leetcode.com/problems/largest-rectangle-in-histogram/",
    },
    reference: `function largestRectangleArea(heights) {
  const st = [];
  let best = 0;
  for (let i = 0; i <= heights.length; i++) {
    const h = i === heights.length ? 0 : heights[i];
    while (st.length && heights[st[st.length - 1]] >= h) {
      const top = st.pop();
      const left = st.length ? st[st.length - 1] + 1 : 0;
      best = Math.max(best, heights[top] * (i - left));
    }
    st.push(i);
  }
  return best;
}`,
  },
];
