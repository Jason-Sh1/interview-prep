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

function bruteScore(ops: string[]): number {
  const kept: number[] = [];
  for (const op of ops) {
    if (op === "C") kept.length--;
    else if (op === "D") kept.push(kept[kept.length - 1] * 2);
    else if (op === "+") kept.push(kept[kept.length - 1] + kept[kept.length - 2]);
    else kept.push(Number(op));
  }
  return kept.reduce((a, b) => a + b, 0);
}

function bruteWarmerWait(t: number[]): number[] {
  return t.map((x, i) => {
    for (let j = i + 1; j < t.length; j++) if (t[j] > x) return j - i;
    return 0;
  });
}

// A car leads its own fleet when every car ahead of it arrives strictly earlier.
function bruteFleets(target: number, pos: number[], speed: number[]): number {
  let fleets = 0;
  for (let i = 0; i < pos.length; i++) {
    let caught = false;
    for (let j = 0; j < pos.length; j++)
      if (pos[j] > pos[i] && (target - pos[j]) * speed[i] >= (target - pos[i]) * speed[j]) caught = true;
    if (!caught) fleets++;
  }
  return fleets;
}

const bigRounds = (() => {
  const ops: string[] = [];
  let size = 0;
  for (let i = 0; i < 2000; i++) {
    const r = (i * 7 + (i >> 3)) % 10;
    if (r === 0 && size >= 1) {
      ops.push("C");
      size--;
    } else if (r === 1 && size >= 1) {
      ops.push("D");
      size++;
    } else if (r === 2 && size >= 2) {
      ops.push("+");
      size++;
    } else {
      ops.push(String(((i * 37) % 61) - 30));
      size++;
    }
  }
  return ops;
})();

// A long postfix chain whose value is tracked while it is built.
const [bigPostfix, bigPostfixValue] = (() => {
  const tokens = ["7"];
  let acc = 7;
  for (let i = 0; i < 1500; i++) {
    const op = ["+", "+", "-", "/", "*"][i % 5];
    const v = op === "*" ? 1 + (i % 2) : ((i * 13) % 9) + 1;
    tokens.push(String(v), op);
    if (op === "+") acc += v;
    else if (op === "-") acc -= v;
    else if (op === "*") acc *= v;
    else acc = Math.trunc(acc / v);
  }
  return [tokens, acc] as const;
})();

const bigTemps = Array.from({ length: 3000 }, (_, i) => 30 + ((i * 7919) % 71));
const fleetPositions = Array.from({ length: 400 }, (_, i) => (i * 7919) % 5000);
const fleetSpeeds = Array.from({ length: 400 }, (_, i) => ((i * 31) % 20) + 1);

// A deeply nested infix expression and its value, built together.
function buildExpression(depth: number, seed: number): [string, number] {
  if (depth === 0) {
    const v = (seed * 37) % 100;
    return [String(v), v];
  }
  const [a, av] = buildExpression(depth - 1, seed * 3 + 1);
  const [b, bv] = buildExpression(depth - 1, seed * 3 + 2);
  const [c, cv] = buildExpression(depth - 1, seed * 3 + 3);
  if (seed % 3 === 0) return [`-((${a}) - (${b})) + (${c})`, -(av - bv) + cv];
  if (seed % 3 === 1) return [`((${a})+(${b}))-(${c})`, av + bv - cv];
  return [`(${a}) - (-(${b}) + (${c}))`, av - (-bv + cv)];
}
const [bigExpr, bigExprValue] = buildExpression(6, 1);

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
  {
    slug: "scorekeeper-log",
    title: "Scorekeeper Log",
    pattern: "stack",
    difficulty: "easy",
    rating: 900,
    statement: `A scorekeeper records a game as a list of entries in \`operations\`. Process them in order, keeping a list of valid scores:

- an integer string such as \`"5"\` or \`"-2"\` records a new score of that value;
- \`"+"\` records a new score equal to the sum of the previous two valid scores;
- \`"D"\` records a new score equal to double the previous valid score;
- \`"C"\` cancels the previous valid score, removing it from the list.

Every entry is guaranteed to be valid when it is applied (for example \`"+"\` always has two scores before it). Return the sum of all valid scores at the end.`,
    constraints: [
      "1 <= operations.length <= 1000",
      "Each entry is \"C\", \"D\", \"+\" or an integer string in [-3 * 10^4, 3 * 10^4].",
      "Every operation is valid when applied.",
    ],
    hints: [
      "Every special entry only looks at, or removes, the most recent scores.",
      "Keep the valid scores on a stack: push numbers, push top * 2 for D, push the sum of the top two for +, pop for C. Sum the stack at the end.",
      "st = []\nfor op in operations:\n    if op == 'C': st.pop()\n    elif op == 'D': st.append(st[-1] * 2)\n    elif op == '+': st.append(st[-1] + st[-2])\n    else: st.append(int(op))\nreturn sum(st)",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "calPoints",
      params: [{ name: "operations", type: "string[]" }],
      returns: "int",
    },
    tests: [
      { input: [["5", "2", "C", "D", "+"]], expected: 30, sample: true },
      { input: [["5", "-2", "4", "C", "D", "9", "+", "+"]], expected: 27, sample: true },
      { input: [["1", "C"]], expected: 0, label: "everything cancelled" },
      { input: [["42"]], expected: 42, label: "single score" },
      { input: [["-3", "D"]], expected: -9, label: "negatives" },
      { input: [["1", "1", "+", "+", "+"]], expected: 12, label: "chained sums" },
      { input: [["2", "D", "C", "D"]], expected: 6, label: "double after cancel" },
      { input: [["0", "0", "+", "D"]], expected: 0, label: "zeros" },
      { input: [bigRounds], expected: bruteScore(bigRounds), label: "large input" },
    ],
    companies: ["Amazon", "Bloomberg", "Apple"],
    source: { name: "LeetCode 682. Baseball Game", url: "https://leetcode.com/problems/baseball-game/" },
    reference: `function calPoints(operations) {
  const st = [];
  for (const op of operations) {
    if (op === "C") st.pop();
    else if (op === "D") st.push(st[st.length - 1] * 2);
    else if (op === "+") st.push(st[st.length - 1] + st[st.length - 2]);
    else st.push(Number(op));
  }
  return st.reduce((a, b) => a + b, 0);
}`,
  },
  {
    slug: "postfix-calculator",
    title: "Postfix Calculator",
    pattern: "stack",
    difficulty: "medium",
    rating: 1200,
    statement: `An arithmetic expression is written in postfix order: each operator comes *after* its two operands, so \`["2", "1", "+", "3", "*"]\` means \`(2 + 1) * 3\`.

Given the expression as a list of \`tokens\` (integers and the operators \`+\`, \`-\`, \`*\`, \`/\`), return its value. Division between integers truncates toward zero. The expression is always valid, never divides by zero, and every intermediate result fits in a 32-bit integer.`,
    constraints: [
      "1 <= tokens.length <= 10^4",
      "Each token is an operator or an integer in [-200, 200].",
      "The expression is valid.",
    ],
    hints: [
      "When you meet an operator, which two values does it apply to?",
      "Push numbers onto a stack. On an operator, pop the right operand, then the left one, apply the operator and push the result. Be careful with the order for - and /, and truncate division toward zero.",
      "st = []\nfor t in tokens:\n    if t in '+-*/':\n        b, a = st.pop(), st.pop()\n        if t == '+': st.append(a + b)\n        elif t == '-': st.append(a - b)\n        elif t == '*': st.append(a * b)\n        else: st.append(int(a / b))\n    else: st.append(int(t))\nreturn st[0]",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "evalRPN",
      params: [{ name: "tokens", type: "string[]" }],
      returns: "int",
    },
    tests: [
      { input: [["2", "1", "+", "3", "*"]], expected: 9, sample: true },
      { input: [["4", "13", "5", "/", "+"]], expected: 6, sample: true },
      { input: [["10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"]], expected: 22, label: "nested" },
      { input: [["18"]], expected: 18, label: "single number" },
      { input: [["3", "5", "-"]], expected: -2, label: "operand order for minus" },
      { input: [["-7", "2", "/"]], expected: -3, label: "truncates toward zero" },
      { input: [["7", "-2", "/"]], expected: -3, label: "negative divisor" },
      { input: [["1", "2", "3", "4", "+", "+", "+"]], expected: 10, label: "operators at the end" },
      { input: [["0", "5", "*"]], expected: 0, label: "zero" },
      { input: [bigPostfix], expected: bigPostfixValue, label: "large input" },
    ],
    companies: ["Amazon", "LinkedIn", "Google", "Meta"],
    source: {
      name: "LeetCode 150. Evaluate Reverse Polish Notation",
      url: "https://leetcode.com/problems/evaluate-reverse-polish-notation/",
    },
    reference: `function evalRPN(tokens) {
  const st = [];
  for (const t of tokens) {
    if (t === "+" || t === "-" || t === "*" || t === "/") {
      const b = st.pop(), a = st.pop();
      if (t === "+") st.push(a + b);
      else if (t === "-") st.push(a - b);
      else if (t === "*") st.push(a * b);
      else st.push(Math.trunc(a / b));
    } else st.push(Number(t));
  }
  return st[0];
}`,
  },
  {
    slug: "wait-for-warmer-day",
    title: "Wait for a Warmer Day",
    pattern: "stack",
    difficulty: "medium",
    rating: 1300,
    statement: `You are given the daily temperatures \`temperatures\`. For each day, count how many days you must wait until a day that is strictly warmer. If no warmer day ever comes, use \`0\` for that day.

Return the counts as an array of the same length.`,
    constraints: ["1 <= temperatures.length <= 10^5", "30 <= temperatures[i] <= 100"],
    hints: [
      "Scanning forward from every day is O(n^2). Which days are still waiting for an answer when you reach a new day?",
      "Keep a stack of indices still waiting, with temperatures decreasing from bottom to top. When a warmer day arrives, pop every colder index and record the distance; then push today.",
      "ans = [0] * n; st = []\nfor i, t in enumerate(temperatures):\n    while st and temperatures[st[-1]] < t:\n        j = st.pop(); ans[j] = i - j\n    st.append(i)\nreturn ans",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "dailyTemperatures",
      params: [{ name: "temperatures", type: "int[]" }],
      returns: "int[]",
    },
    tests: [
      { input: [[73, 74, 75, 71, 69, 72, 76, 73]], expected: [1, 1, 4, 2, 1, 1, 0, 0], sample: true },
      { input: [[30, 40, 50, 60]], expected: [1, 1, 1, 0], sample: true },
      { input: [[30, 60, 90]], expected: [1, 1, 0], label: "increasing" },
      { input: [[90, 80, 70]], expected: [0, 0, 0], label: "decreasing" },
      { input: [[50]], expected: [0], label: "single day" },
      { input: [[55, 55, 55]], expected: [0, 0, 0], label: "equal is not warmer" },
      { input: [[70, 60, 60, 80]], expected: [3, 2, 1, 0], label: "one warm day ends many waits" },
      { input: [[34, 80, 80, 34, 34, 80, 80, 80, 80, 34]], expected: [1, 0, 0, 2, 1, 0, 0, 0, 0, 0], label: "plateaus" },
      { input: [bigTemps], expected: bruteWarmerWait(bigTemps), label: "large input" },
    ],
    companies: ["Amazon", "Meta", "Google", "Microsoft", "Bloomberg"],
    source: { name: "LeetCode 739. Daily Temperatures", url: "https://leetcode.com/problems/daily-temperatures/" },
    reference: `function dailyTemperatures(temperatures) {
  const ans = new Array(temperatures.length).fill(0);
  const st = [];
  for (let i = 0; i < temperatures.length; i++) {
    while (st.length && temperatures[st[st.length - 1]] < temperatures[i]) {
      const j = st.pop();
      ans[j] = i - j;
    }
    st.push(i);
  }
  return ans;
}`,
  },
  {
    slug: "convoys-to-the-finish",
    title: "Convoys to the Finish",
    pattern: "stack",
    difficulty: "medium",
    rating: 1450,
    statement: `\`n\` cars drive along a one-lane road toward a finish line at mile \`target\`. Car \`i\` starts at mile \`position[i]\` (all different) and drives at \`speed[i]\` miles per hour.

A car can never pass the car ahead of it. When a faster car catches a slower one, it slows down and the two travel together as a *convoy* at the slower speed. A car that catches up exactly at the finish line still joins that convoy. A single car on its own is also a convoy.

Return how many convoys cross the finish line.`,
    constraints: [
      "1 <= n <= 10^5",
      "0 < target <= 10^6",
      "0 <= position[i] < target, all positions are different",
      "0 < speed[i] <= 10^6",
    ],
    hints: [
      "Process the cars from the one closest to the finish backward. What decides whether a car ends up in the convoy ahead of it?",
      "Compute each car's solo arrival time (target - position) / speed. Going from nearest to farthest, a car whose time is not larger than the current convoy's time joins it; a larger time starts a new convoy (which becomes the new one to beat).",
      "cars = sorted(zip(position, speed), reverse=True)\nfleets = 0; slowest = 0\nfor p, s in cars:\n    t = (target - p) / s\n    if t > slowest:\n        fleets += 1; slowest = t\nreturn fleets",
    ],
    complexity: { time: "O(n log n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "carFleet",
      params: [
        { name: "target", type: "int" },
        { name: "position", type: "int[]" },
        { name: "speed", type: "int[]" },
      ],
      returns: "int",
    },
    tests: [
      { input: [12, [10, 8, 0, 5, 3], [2, 4, 1, 1, 3]], expected: 3, sample: true },
      { input: [10, [3], [3]], expected: 1, sample: true },
      { input: [100, [0, 2, 4], [4, 2, 1]], expected: 1, label: "everyone catches up" },
      { input: [10, [0, 4, 8], [1, 1, 1]], expected: 3, label: "same speeds" },
      { input: [10, [6, 8], [3, 2]], expected: 2, label: "never catches up" },
      { input: [10, [0, 5], [2, 1]], expected: 1, label: "meet exactly at the finish" },
      { input: [20, [6, 2, 17], [3, 9, 2]], expected: 2, label: "unsorted input" },
      { input: [10, [9, 8, 7], [1, 1, 1]], expected: 3, label: "close to the finish" },
      { input: [5000, fleetPositions, fleetSpeeds], expected: bruteFleets(5000, fleetPositions, fleetSpeeds), label: "large input" },
    ],
    companies: ["Google", "Amazon", "Meta"],
    source: { name: "LeetCode 853. Car Fleet", url: "https://leetcode.com/problems/car-fleet/" },
    reference: `function carFleet(target, position, speed) {
  const cars = position.map((p, i) => [p, speed[i]]).sort((a, b) => b[0] - a[0]);
  let fleets = 0, slowest = 0;
  for (const [p, s] of cars) {
    const t = (target - p) / s;
    if (t > slowest) {
      fleets++;
      slowest = t;
    }
  }
  return fleets;
}`,
  },
  {
    slug: "pocket-calculator",
    title: "Pocket Calculator",
    pattern: "stack",
    difficulty: "hard",
    rating: 1700,
    statement: `Given a string \`s\` holding a valid arithmetic expression, return its value. The expression contains non-negative integers, \`+\`, \`-\`, parentheses and spaces.

\`-\` may also be used as a unary sign, as in \`"-1"\` or \`"-(2 + 3)"\`, but \`+\` is never unary and two operators never appear next to each other. Do not use a built-in expression evaluator such as \`eval\`.`,
    constraints: [
      "1 <= s.length <= 3 * 10^5",
      "s consists of digits, '+', '-', '(', ')' and ' '.",
      "s is a valid expression; every intermediate value fits in a 32-bit integer.",
    ],
    hints: [
      "With only + and -, every number ends up added or subtracted. Its final sign is the product of the signs in front of it and in front of each enclosing pair of parentheses.",
      "Scan left to right keeping a running result and the current sign. On '(' push the result and sign so far, then start fresh; on ')' finish the inner result, multiply by the saved sign and add the saved result.",
      "res, num, sign, st = 0, 0, 1, []\nfor c in s:\n    if c.isdigit(): num = num * 10 + int(c)\n    elif c in '+-':\n        res += sign * num; num = 0\n        sign = 1 if c == '+' else -1\n    elif c == '(':\n        st.append((res, sign)); res, sign = 0, 1\n    elif c == ')':\n        res += sign * num; num = 0\n        prev, psign = st.pop()\n        res = prev + psign * res\nreturn res + sign * num",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "calculate",
      params: [{ name: "s", type: "string" }],
      returns: "int",
    },
    tests: [
      { input: ["1 + 1"], expected: 2, sample: true },
      { input: ["(1+(4+5+2)-3)+(6+8)"], expected: 23, sample: true },
      { input: [" 2-1 + 2 "], expected: 3, label: "spaces" },
      { input: ["-(2 + 3)"], expected: -5, label: "unary minus before parentheses" },
      { input: ["-7"], expected: -7, label: "unary minus" },
      { input: ["42"], expected: 42, label: "single number" },
      { input: ["1-(     -2)"], expected: 3, label: "unary minus inside parentheses" },
      { input: ["10 - (2 - (3 - 4))"], expected: 7, label: "nested subtraction" },
      { input: ["((((5))))"], expected: 5, label: "deep parentheses" },
      { input: ["2147483647 - 2147483647"], expected: 0, label: "large numbers" },
      { input: [bigExpr], expected: bigExprValue, label: "large input" },
    ],
    companies: ["Google", "Meta", "Amazon", "Microsoft", "Uber"],
    source: { name: "LeetCode 224. Basic Calculator", url: "https://leetcode.com/problems/basic-calculator/" },
    reference: `function calculate(s) {
  let res = 0, num = 0, sign = 1;
  const st = [];
  for (const c of s) {
    if (c >= "0" && c <= "9") num = num * 10 + (c.charCodeAt(0) - 48);
    else if (c === "+" || c === "-") {
      res += sign * num;
      num = 0;
      sign = c === "+" ? 1 : -1;
    } else if (c === "(") {
      st.push([res, sign]);
      res = 0;
      sign = 1;
    } else if (c === ")") {
      res += sign * num;
      num = 0;
      const [prev, psign] = st.pop();
      res = prev + psign * res;
    }
  }
  return res + sign * num;
}`,
  },
];
