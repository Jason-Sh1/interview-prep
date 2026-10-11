import type { Problem } from "../types";

export const greedy: Problem[] = [
  {
    slug: "unlimited-trades-profit",
    title: "Unlimited Trades Profit",
    pattern: "greedy",
    difficulty: "easy",
    rating: 1050,
    statement: `\`prices[i]\` is the price of a stock on day \`i\`. You may buy and sell as many times as you like, but you can hold at most one share at any moment (you can sell and buy again on the same day).

Return the largest total profit you can make. If no trade helps, return \`0\`.`,
    constraints: ["1 <= prices.length <= 3 * 10^4", "0 <= prices[i] <= 10^4"],
    hints: [
      "A long climb from day a to day b gives the same profit as all the small day-to-day steps inside it.",
      "Add up every positive difference prices[i] - prices[i - 1]. Taking every upward step is never worse than any other plan.",
      "profit = 0\nfor i in range(1, len(prices)):\n    profit += max(0, prices[i] - prices[i - 1])\nreturn profit",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "maxProfit",
      params: [{ name: "prices", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[7, 1, 5, 3, 6, 4]], expected: 7, sample: true },
      { input: [[1, 2, 3, 4, 5]], expected: 4, sample: true },
      { input: [[7, 6, 4, 3, 1]], expected: 0, label: "falling prices" },
      { input: [[5]], expected: 0, label: "single day" },
      { input: [[2, 2, 2]], expected: 0, label: "flat prices" },
      { input: [[3, 1, 4, 1, 5, 9, 2, 6]], expected: 15, label: "many swings" },
      { input: [[1, 5, 1, 5]], expected: 8, label: "repeated peaks" },
      { input: [[0, 10000]], expected: 10000, label: "extreme prices" },
    ],
    companies: ["Amazon", "Bloomberg", "Meta", "Goldman Sachs"],
    source: {
      name: "LeetCode 122. Best Time to Buy and Sell Stock II",
      url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock-ii/",
    },
    reference: `function maxProfit(prices) {
  let profit = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) profit += prices[i] - prices[i - 1];
  }
  return profit;
}`,
  },
  {
    slug: "hop-to-the-end",
    title: "Hop to the End",
    pattern: "greedy",
    difficulty: "medium",
    rating: 1300,
    statement: `You start on the first cell of an array \`nums\`. From cell \`i\` you may hop forward by any distance from \`0\` up to \`nums[i]\`.

Return \`true\` if you can land on the last cell, and \`false\` otherwise.`,
    constraints: ["1 <= nums.length <= 10^4", "0 <= nums[i] <= 10^5"],
    hints: [
      "You don't need to know which hops you take, only how far you could possibly get.",
      "Scan left to right keeping the farthest index reachable so far. If you ever stand on an index beyond that, you're stuck.",
      "far = 0\nfor i, x in enumerate(nums):\n    if i > far: return False\n    far = max(far, i + x)\nreturn True",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "canJump",
      params: [{ name: "nums", type: "int[]" }],
      returns: "bool",
    },
    tests: [
      { input: [[2, 3, 1, 1, 4]], expected: true, sample: true },
      { input: [[3, 2, 1, 0, 4]], expected: false, sample: true },
      { input: [[0]], expected: true, label: "single cell" },
      { input: [[0, 1]], expected: false, label: "stuck at start" },
      { input: [[1, 0, 1]], expected: false, label: "zero in the middle" },
      { input: [[2, 0, 0]], expected: true, label: "jump over zeros" },
      { input: [[5, 0, 0, 0, 0, 0]], expected: true, label: "one big hop" },
      { input: [Array(2000).fill(1)], expected: true, label: "long array of ones" },
      { input: [[...Array(1999).fill(1), 0, 0, 1]], expected: false, label: "long array, blocked near end" },
    ],
    companies: ["Amazon", "Microsoft", "Meta", "Apple"],
    source: { name: "LeetCode 55. Jump Game", url: "https://leetcode.com/problems/jump-game/" },
    reference: `function canJump(nums) {
  let far = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i > far) return false;
    far = Math.max(far, i + nums[i]);
  }
  return true;
}`,
  },
  {
    slug: "fuel-loop-start",
    title: "Fuel Loop Start",
    pattern: "greedy",
    difficulty: "medium",
    rating: 1550,
    statement: `Fuel stations \`0..n-1\` sit around a circular road. Station \`i\` gives you \`gas[i]\` units of fuel, and driving from station \`i\` to station \`(i + 1) % n\` burns \`cost[i]\` units.

Your car's tank is unlimited but starts empty. You pick one station to start from, fill up there, and drive around clockwise. Return the index of the starting station that lets you complete a full loop back to it, or \`-1\` if no station works. When a solution exists it is guaranteed to be unique.`,
    constraints: [
      "n == gas.length == cost.length",
      "1 <= n <= 10^5",
      "0 <= gas[i], cost[i] <= 10^4",
    ],
    hints: [
      "If the total fuel is less than the total cost, no start can work. Otherwise, think about where a failed attempt tells you not to start.",
      "Walk once, tracking the tank since the current candidate start. If the tank goes negative at station i, no station between the start and i can work either, so restart the candidate at i + 1.",
      "if sum(gas) < sum(cost): return -1\nstart = tank = 0\nfor i in range(n):\n    tank += gas[i] - cost[i]\n    if tank < 0: start, tank = i + 1, 0\nreturn start",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "canCompleteCircuit",
      params: [
        { name: "gas", type: "int[]" },
        { name: "cost", type: "int[]" },
      ],
      returns: "int",
    },
    tests: [
      { input: [[1, 2, 3, 4, 5], [3, 4, 5, 1, 2]], expected: 3, sample: true },
      { input: [[2, 3, 4], [3, 4, 3]], expected: -1, sample: true },
      { input: [[5], [4]], expected: 0, label: "single station" },
      { input: [[1], [2]], expected: -1, label: "single station, not enough" },
      { input: [[3, 1, 1], [1, 2, 2]], expected: 0, label: "start at first station" },
      { input: [[1, 1, 3], [2, 2, 1]], expected: 2, label: "start at last station" },
      { input: [[4, 5, 2, 6, 5, 3], [3, 2, 7, 3, 2, 9]], expected: -1, label: "total short by one" },
      { input: [[0, 0, 7, 0], [1, 1, 1, 1]], expected: 2, label: "zeros" },
    ],
    companies: ["Amazon", "Google", "Bloomberg", "Microsoft"],
    source: { name: "LeetCode 134. Gas Station", url: "https://leetcode.com/problems/gas-station/" },
    reference: `function canCompleteCircuit(gas, cost) {
  let total = 0, tank = 0, start = 0;
  for (let i = 0; i < gas.length; i++) {
    const d = gas[i] - cost[i];
    total += d;
    tank += d;
    if (tank < 0) { start = i + 1; tank = 0; }
  }
  return total < 0 ? -1 : start;
}`,
  },
];
