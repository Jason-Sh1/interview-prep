import type { Problem } from "../types";

// Brute-force helpers (slower but obviously correct) for expected values.
function snacksBrute(greed: number[], sizes: number[]): number {
  // Biggest snack to the greediest kid it can satisfy, kid by kid from the greediest.
  const kids = greed.slice().sort((a, b) => b - a);
  const left = sizes.slice().sort((a, b) => b - a);
  let fed = 0;
  for (const g of kids) {
    if (left.length && left[0] >= g) {
      left.shift();
      fed++;
    }
  }
  return fed;
}

function bestSumBrute(nums: number[]): number {
  let best = -Infinity;
  for (let i = 0; i < nums.length; i++) {
    let sum = 0;
    for (let j = i; j < nums.length; j++) best = Math.max(best, (sum += nums[j]));
  }
  return best;
}

function piecesBrute(s: string): number[] {
  const sizes: number[] = [];
  let start = 0;
  for (let cut = 1; cut <= s.length; cut++) {
    const before = new Set(s.slice(0, cut));
    const after = s.slice(cut);
    if (cut === s.length || ![...after].some((ch) => before.has(ch))) {
      sizes.push(cut - start);
      start = cut;
    }
  }
  return sizes;
}

function hopsBrute(nums: number[]): number {
  const best = nums.map(() => Infinity);
  best[0] = 0;
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j <= Math.min(nums.length - 1, i + nums[i]); j++) best[j] = Math.min(best[j], best[i] + 1);
  return best[nums.length - 1];
}

function treatsBySweeps(ratings: number[]): number {
  const give = ratings.map(() => 1);
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < ratings.length; i++) {
      if (i > 0 && ratings[i] > ratings[i - 1] && give[i] <= give[i - 1]) {
        give[i] = give[i - 1] + 1;
        changed = true;
      }
      if (i + 1 < ratings.length && ratings[i] > ratings[i + 1] && give[i] <= give[i + 1]) {
        give[i] = give[i + 1] + 1;
        changed = true;
      }
    }
  }
  return give.reduce((a, b) => a + b, 0);
}

const kidsGreed = Array.from({ length: 1500 }, (_, i) => ((i * 7919) % 2000) + 1);
const snackSizes = Array.from({ length: 1200 }, (_, i) => ((i * 104729) % 1100) + 1);
const swings = Array.from({ length: 3000 }, (_, i) => ((i * 7919 + 17) % 201) - 100);
// Thirteen zones with two letters each; every fourth zone leaks a letter into the next zone.
const lettersRun = Array.from({ length: 13 }, (_, k) => {
  const zone = Array.from({ length: 30 + ((k * 7) % 17) }, (_, j) => String.fromCharCode(97 + 2 * k + ((j * 5) % 3 === 0 ? 1 : 0)));
  if (k % 4 === 1) zone[0] = String.fromCharCode(97 + 2 * k + 2);
  return zone.join("");
}).join("");
const hopLengths = Array.from({ length: 2000 }, (_, i) => ((i * 37) % 9) + 1);
const bumpyRatings = Array.from({ length: 1500 }, (_, i) => (i * 31) % 17 + Math.floor(i / 100));

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
  {
    slug: "snacks-for-picky-kids",
    title: "Snacks for Picky Kids",
    pattern: "greedy",
    difficulty: "easy",
    rating: 950,
    statement: `Each kid \`i\` will only be happy with a snack of size at least \`greed[i]\`. You have snacks of sizes \`sizes\`, and each kid gets at most one snack (each snack goes to at most one kid).

Return the largest number of kids you can make happy.`,
    constraints: ["1 <= greed.length <= 3 * 10^4", "0 <= sizes.length <= 3 * 10^4", "1 <= greed[i], sizes[j] <= 2^31 - 1"],
    hints: [
      "Giving a big snack to a kid who would be happy with a small one wastes it. Which kid should the smallest snack go to?",
      "Sort both lists. Walk through the snacks from smallest to largest with a pointer on the least greedy unsatisfied kid; whenever the snack is big enough, that kid is happy and the pointer moves on.",
      "greed.sort(); sizes.sort()\nkid = 0\nfor s in sizes:\n    if kid < len(greed) and s >= greed[kid]: kid += 1\nreturn kid",
    ],
    complexity: { time: "O(n log n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "findContentChildren",
      params: [
        { name: "greed", type: "int[]" },
        { name: "sizes", type: "int[]" },
      ],
      returns: "int",
    },
    tests: [
      { input: [[1, 2, 3], [1, 1]], expected: 1, sample: true },
      { input: [[1, 2], [1, 2, 3]], expected: 2, sample: true },
      { input: [[1, 2, 3], []], expected: 0, label: "no snacks" },
      { input: [[5], [4]], expected: 0, label: "snack too small" },
      { input: [[2, 2, 2], [2, 2, 2]], expected: 3, label: "exact matches" },
      { input: [[10, 9, 8, 7], [5, 6, 7, 8]], expected: 2, label: "unsorted input" },
      { input: [[1, 1, 1], [100]], expected: 1, label: "one big snack" },
      { input: [[2147483647], [2147483647]], expected: 1, label: "largest values" },
      { input: [kidsGreed, snackSizes], expected: snacksBrute(kidsGreed, snackSizes), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Apple"],
    source: { name: "LeetCode 455. Assign Cookies", url: "https://leetcode.com/problems/assign-cookies/" },
    reference: `function findContentChildren(greed, sizes) {
  const g = greed.slice().sort((a, b) => a - b);
  const s = sizes.slice().sort((a, b) => a - b);
  let kid = 0;
  for (const x of s) if (kid < g.length && x >= g[kid]) kid++;
  return kid;
}`,
  },
  {
    slug: "best-contiguous-sum",
    title: "Best Contiguous Sum",
    pattern: "greedy",
    difficulty: "medium",
    rating: 1150,
    statement: `Given an integer array \`nums\`, choose a non-empty stretch of consecutive elements with the largest possible total, and return that total.`,
    constraints: ["1 <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
    hints: [
      "Scan left to right. When is it better to throw away the stretch you have been building and start fresh?",
      "Kadane's algorithm: keep the best sum of a stretch ending at the current index, which is max(nums[i], previous + nums[i]). Track the largest such value.",
      "cur = best = nums[0]\nfor x in nums[1:]:\n    cur = max(x, cur + x)\n    best = max(best, cur)\nreturn best",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "maxSubArray",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6, sample: true },
      { input: [[5, 4, -1, 7, 8]], expected: 23, sample: true },
      { input: [[1]], expected: 1, label: "single element" },
      { input: [[-3, -1, -2]], expected: -1, label: "all negative" },
      { input: [[0, 0, 0]], expected: 0, label: "all zero" },
      { input: [[2, -1, 2]], expected: 3, label: "dip worth keeping" },
      { input: [[3, -10, 4]], expected: 4, label: "start fresh" },
      { input: [[-10000, 10000, -10000]], expected: 10000, label: "extreme values" },
      { input: [swings], expected: bestSumBrute(swings), label: "large input" },
    ],
    companies: ["Amazon", "Microsoft", "LinkedIn", "Apple", "Bloomberg"],
    source: { name: "LeetCode 53. Maximum Subarray", url: "https://leetcode.com/problems/maximum-subarray/" },
    reference: `function maxSubArray(nums) {
  let cur = nums[0], best = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    best = Math.max(best, cur);
  }
  return best;
}`,
  },
  {
    slug: "split-so-letters-stay-together",
    title: "Split So Letters Stay Together",
    pattern: "greedy",
    difficulty: "medium",
    rating: 1350,
    statement: `Cut the string \`s\` into as many consecutive pieces as possible so that every letter appears in at most one piece (all copies of a letter end up in the same piece).

Return the lengths of the pieces, from left to right.`,
    constraints: ["1 <= s.length <= 500", "s consists of lowercase English letters."],
    hints: [
      "Once a piece contains a letter, it must stretch at least as far as that letter's last occurrence.",
      "Record each letter's last index. Walk the string extending the current piece's end to the furthest last index seen; when your position reaches that end, close the piece.",
      "last = {c: i for i, c in enumerate(s)}\nout, start, end = [], 0, 0\nfor i, c in enumerate(s):\n    end = max(end, last[c])\n    if i == end:\n        out.append(end - start + 1); start = i + 1\nreturn out",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "partitionLabels",
      params: [{ name: "s", type: "string" }],
      returns: "int[]",
    },
    tests: [
      { input: ["ababcbacadefegdehijhklij"], expected: [9, 7, 8], sample: true },
      { input: ["eccbbbbdec"], expected: [10], sample: true },
      { input: ["a"], expected: [1], label: "single letter" },
      { input: ["abc"], expected: [1, 1, 1], label: "all distinct" },
      { input: ["abca"], expected: [4], label: "first letter repeats at the end" },
      { input: ["aabbcc"], expected: [2, 2, 2], label: "blocks of repeats" },
      { input: ["abacdcd"], expected: [3, 4], label: "two pieces" },
      { input: ["caedbdedda"], expected: piecesBrute("caedbdedda"), label: "nested spans" },
      { input: [lettersRun], expected: piecesBrute(lettersRun), label: "large input" },
    ],
    companies: ["Amazon", "Meta", "Google", "Microsoft"],
    source: { name: "LeetCode 763. Partition Labels", url: "https://leetcode.com/problems/partition-labels/" },
    reference: `function partitionLabels(s) {
  const last = {};
  for (let i = 0; i < s.length; i++) last[s[i]] = i;
  const out = [];
  let start = 0, end = 0;
  for (let i = 0; i < s.length; i++) {
    end = Math.max(end, last[s[i]]);
    if (i === end) { out.push(end - start + 1); start = i + 1; }
  }
  return out;
}`,
  },
  {
    slug: "fewest-hops-to-the-end",
    title: "Fewest Hops to the End",
    pattern: "greedy",
    difficulty: "medium",
    rating: 1420,
    statement: `You stand on index \`0\` of an array \`nums\`. From index \`i\` you can hop forward to any index from \`i + 1\` up to \`i + nums[i]\`.

Return the fewest hops needed to reach the last index. It is guaranteed that the last index can be reached.`,
    constraints: ["1 <= nums.length <= 10^4", "0 <= nums[i] <= 1000", "The last index is reachable."],
    hints: [
      "Think in rounds like a BFS: which indices can you reach with one hop, with two hops, and so on?",
      "Track the end of the current round's reach and the furthest index reachable from anything inside it. When you pass the current end, you must take another hop, and the new end is that furthest index.",
      "hops, end, far = 0, 0, 0\nfor i in range(len(nums) - 1):\n    far = max(far, i + nums[i])\n    if i == end:\n        hops += 1; end = far\nreturn hops",
    ],
    complexity: { time: "O(n)", space: "O(1)" },
    signature: {
      kind: "function",
      name: "jump",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[2, 3, 1, 1, 4]], expected: 2, sample: true },
      { input: [[2, 3, 0, 1, 4]], expected: 2, sample: true },
      { input: [[0]], expected: 0, label: "already at the end" },
      { input: [[1, 1, 1, 1]], expected: 3, label: "one step at a time" },
      { input: [[5, 1, 1, 1, 1]], expected: 1, label: "one big hop" },
      { input: [[1, 2]], expected: 1, label: "two elements" },
      { input: [[1, 4, 1, 1, 1, 0]], expected: 2, label: "zero at the end" },
      { input: [[2, 1, 3, 1, 1, 1, 1]], expected: hopsBrute([2, 1, 3, 1, 1, 1, 1]), label: "short hop sets up a long one" },
      { input: [hopLengths], expected: hopsBrute(hopLengths), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Microsoft", "Apple", "Bloomberg"],
    source: { name: "LeetCode 45. Jump Game II", url: "https://leetcode.com/problems/jump-game-ii/" },
    reference: `function jump(nums) {
  let hops = 0, end = 0, far = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    far = Math.max(far, i + nums[i]);
    if (i === end) { hops++; end = far; }
  }
  return hops;
}`,
  },
  {
    slug: "fair-treat-handout",
    title: "Fair Treat Handout",
    pattern: "greedy",
    difficulty: "hard",
    rating: 1700,
    statement: `Kids stand in a line, and kid \`i\` has a score \`ratings[i]\`. You hand out treats so that:

- every kid gets at least one treat, and
- a kid whose score is higher than a neighbor's gets more treats than that neighbor.

Return the fewest treats you need in total. Neighbors with equal scores have no constraint between them.`,
    constraints: ["1 <= ratings.length <= 2 * 10^4", "0 <= ratings[i] <= 2 * 10^4"],
    hints: [
      "Each kid has a constraint from the left neighbor and one from the right. Can you satisfy them in separate passes?",
      "Pass left to right: if ratings[i] > ratings[i - 1], give one more than the left neighbor. Pass right to left: if ratings[i] > ratings[i + 1], take the max of the current amount and the right neighbor's + 1. Sum the result.",
      "give = [1] * n\nfor i in range(1, n):\n    if r[i] > r[i - 1]: give[i] = give[i - 1] + 1\nfor i in range(n - 2, -1, -1):\n    if r[i] > r[i + 1]: give[i] = max(give[i], give[i + 1] + 1)\nreturn sum(give)",
    ],
    complexity: { time: "O(n)", space: "O(n)" },
    signature: {
      kind: "function",
      name: "candy",
      params: [{ name: "ratings", type: "int[]" }],
      returns: "int",
    },
    tests: [
      { input: [[1, 0, 2]], expected: 5, sample: true },
      { input: [[1, 2, 2]], expected: 4, sample: true },
      { input: [[7]], expected: 1, label: "single kid" },
      { input: [[3, 3, 3]], expected: 3, label: "all equal" },
      { input: [[1, 2, 3, 4]], expected: 10, label: "increasing" },
      { input: [[4, 3, 2, 1]], expected: 10, label: "decreasing" },
      { input: [[1, 3, 2, 2, 1]], expected: 7, label: "equal neighbors reset" },
      { input: [[1, 2, 87, 87, 87, 2, 1]], expected: 13, label: "plateau peak" },
      { input: [[1, 6, 10, 8, 7, 3, 2]], expected: treatsBySweeps([1, 6, 10, 8, 7, 3, 2]), label: "long downhill after a peak" },
      { input: [bumpyRatings], expected: treatsBySweeps(bumpyRatings), label: "large input" },
    ],
    companies: ["Amazon", "Google", "Microsoft", "Uber"],
    source: { name: "LeetCode 135. Candy", url: "https://leetcode.com/problems/candy/" },
    reference: `function candy(ratings) {
  const n = ratings.length;
  const give = new Array(n).fill(1);
  for (let i = 1; i < n; i++) if (ratings[i] > ratings[i - 1]) give[i] = give[i - 1] + 1;
  for (let i = n - 2; i >= 0; i--) if (ratings[i] > ratings[i + 1]) give[i] = Math.max(give[i], give[i + 1] + 1);
  return give.reduce((a, b) => a + b, 0);
}`,
  },
];
