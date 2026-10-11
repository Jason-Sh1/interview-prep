import type { Problem } from "../types";

export const recursion: Problem[] = [
  {
    slug: "golden-sequence-term",
    title: "Golden Sequence Term",
    pattern: "recursion",
    difficulty: "easy",
    rating: 950,
    statement: `A number sequence starts with \`0\` and \`1\`. Every later term is the sum of the two terms right before it, so the sequence begins \`0, 1, 1, 2, 3, 5, 8, ...\`.

Given \`n\`, return the term at position \`n\` (positions start at 0).

A plain recursive solution recomputes the same terms an exponential number of times. Make yours fast enough for \`n = 45\`.`,
    constraints: ["0 <= n <= 45"],
    hints: [
      "Write the definition as a recursive function first. How many times does it compute term 2 when n = 10?",
      "Cache each term the first time you compute it (memoization), or build the terms bottom-up keeping only the last two.",
      "memo = {0: 0, 1: 1}\ndef f(n):\n    if n not in memo:\n        memo[n] = f(n - 1) + f(n - 2)\n    return memo[n]",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "fib",
      params: [{ name: "n", type: "int" }],
      returns: "int",
    },
    tests: [
      { input: [4], expected: 3, sample: true },
      { input: [10], expected: 55, sample: true },
      { input: [0], expected: 0, label: "first term" },
      { input: [1], expected: 1, label: "second term" },
      { input: [2], expected: 1, label: "smallest sum" },
      { input: [20], expected: 6765, label: "medium n" },
      { input: [30], expected: 832040, label: "larger n" },
      { input: [45], expected: 1134903170, label: "largest n (needs memo)" },
    ],
    companies: ["Amazon", "Microsoft", "Apple", "Adobe"],
    source: { name: "LeetCode 509. Fibonacci Number", url: "https://leetcode.com/problems/fibonacci-number/" },
    reference: `function fib(n) {
  if (n < 2) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    const c = a + b;
    a = b;
    b = c;
  }
  return b;
}`,
  },
  {
    slug: "fast-exponent",
    title: "Fast Exponent",
    pattern: "recursion",
    difficulty: "medium",
    rating: 1320,
    statement: `Given a real number \`x\` and an integer \`n\`, compute \`x\` raised to the power \`n\` without using a built-in power function.

\`n\` may be negative (then the answer is \`1 / x^|n|\`) and can be as large as about two billion in absolute value, so multiplying \`x\` by itself \`n\` times is far too slow. Answers are checked to within \`1e-5\`.`,
    constraints: [
      "-100.0 < x < 100.0",
      "-2^31 <= n <= 2^31 - 1",
      "x is not 0 when n is negative",
      "-10^4 <= x^n <= 10^4",
    ],
    hints: [
      "x^10 = (x^5)^2. How does that let you halve the exponent each step?",
      "Recurse on n // 2: square the half result, and multiply by one extra x when n is odd. For negative n, compute with -n and take the reciprocal.",
      "def pow(x, n):\n    if n < 0: return 1 / pow(x, -n)\n    if n == 0: return 1\n    half = pow(x, n // 2)\n    return half * half * (x if n % 2 else 1)",
    ],
    complexity: { time: "O(log n)", space: "O(log n)" },
    signature: {
      kind: "function",
      name: "myPow",
      params: [
        { name: "x", type: "float" },
        { name: "n", type: "int" },
      ],
      returns: "float",
      compare: "float",
    },
    tests: [
      { input: [2.0, 10], expected: 1024.0, sample: true },
      { input: [2.0, -2], expected: 0.25, sample: true },
      { input: [2.1, 3], expected: 9.261, label: "fractional base" },
      { input: [5.0, 0], expected: 1.0, label: "zero exponent" },
      { input: [-2.0, 3], expected: -8.0, label: "negative base, odd power" },
      { input: [-2.0, 4], expected: 16.0, label: "negative base, even power" },
      { input: [1.0, 2147483647], expected: 1.0, label: "huge exponent" },
      { input: [-1.0, -2147483647], expected: -1.0, label: "huge negative odd exponent" },
      { input: [2.0, -2147483648], expected: 0.0, label: "most negative exponent" },
      { input: [0.5, 4], expected: 0.0625, label: "base below one" },
    ],
    companies: ["Meta", "Google", "Amazon", "LinkedIn", "Bloomberg"],
    source: { name: "LeetCode 50. Pow(x, n)", url: "https://leetcode.com/problems/powx-n/" },
    reference: `function myPow(x, n) {
  function go(b, e) {
    if (e === 0) return 1;
    const half = go(b, Math.floor(e / 2));
    return e % 2 === 1 ? half * half * b : half * half;
  }
  return n < 0 ? 1 / go(x, -n) : go(x, n);
}`,
  },
  {
    slug: "every-bracketing-result",
    title: "Every Bracketing Result",
    pattern: "recursion",
    difficulty: "medium",
    rating: 1620,
    statement: `You get an arithmetic expression \`expression\` made of non-negative integers joined by the operators \`+\`, \`-\` and \`*\` (no spaces, no parentheses).

Imagine inserting parentheses in every possible way so that the order of evaluation is fully determined. Return the value produced by each distinct way of bracketing, in any order. Two different bracketings that happen to produce the same number each contribute their own entry, so the output can contain repeated values.`,
    constraints: [
      "1 <= expression.length <= 20",
      "expression contains only digits and the characters '+', '-', '*'",
      "Every number in the expression is between 0 and 99",
      "The output has at most 10^4 values",
    ],
    hints: [
      "Whichever operator is evaluated last splits the expression into a left part and a right part.",
      "For each operator position, recursively get all values of the left side and all values of the right side, then combine every pair. Memoize by substring (start, end) since the same pieces recur.",
      "def ways(s):\n    if s is a number: return [int(s)]\n    out = []\n    for i, c in enumerate(s):\n        if c in '+-*':\n            for a in ways(s[:i]):\n                for b in ways(s[i+1:]):\n                    out.append(apply(c, a, b))\n    return out  # cache by s",
    ],
    complexity: { time: "O(C_n * n)", space: "O(C_n * n)" },
    signature: {
      kind: "function",
      name: "diffWaysToCompute",
      params: [{ name: "expression", type: "string" }],
      returns: "int[]",
      compare: "unordered",
    },
    tests: [
      { input: ["2-1-1"], expected: [0, 2], sample: true },
      { input: ["2*3-4*5"], expected: [-34, -14, -10, -10, 10], sample: true },
      { input: ["7"], expected: [7], label: "single number" },
      { input: ["11"], expected: [11], label: "multi-digit number" },
      { input: ["2*3"], expected: [6], label: "one operator" },
      { input: ["1+2+3"], expected: [6, 6], label: "repeated values" },
      { input: ["10-5*2"], expected: [10, 0], label: "precedence ignored" },
      { input: ["1-2-3-4"], expected: [-8, -2, 0, 6, -2], label: "negative results" },
      { input: ["0*99"], expected: [0], label: "zero operand" },
    ],
    companies: ["Google", "Amazon", "Bloomberg", "Uber"],
    source: {
      name: "LeetCode 241. Different Ways to Add Parentheses",
      url: "https://leetcode.com/problems/different-ways-to-add-parentheses/",
    },
    reference: `function diffWaysToCompute(expression) {
  const memo = new Map();
  function go(lo, hi) {
    const key = lo + ":" + hi;
    if (memo.has(key)) return memo.get(key);
    const out = [];
    for (let i = lo; i < hi; i++) {
      const c = expression[i];
      if (c === "+" || c === "-" || c === "*") {
        const left = go(lo, i);
        const right = go(i + 1, hi);
        for (const a of left) {
          for (const b of right) {
            out.push(c === "+" ? a + b : c === "-" ? a - b : a * b);
          }
        }
      }
    }
    if (out.length === 0) out.push(Number(expression.slice(lo, hi)));
    memo.set(key, out);
    return out;
  }
  return go(0, expression.length);
}`,
  },
];
