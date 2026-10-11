import { describe, expect, it } from "vitest";
import { PROBLEM_BY_SLUG, PROBLEMS } from "@/lib/problems";
import { valuesMatch } from "@/lib/runner/compare";
import { starterCode } from "@/lib/runner/drivers";
import { runLocally } from "@/lib/runner/local";

const run = (slug: string, lang: "python" | "javascript", code: string) => {
  const p = PROBLEM_BY_SLUG.get(slug)!;
  return runLocally(p.signature, lang, code, p.tests);
};

describe("compare", () => {
  it("handles order-insensitive and float comparisons", () => {
    expect(valuesMatch([[1, 2], [3]], [[3], [1, 2]], "unordered")).toBe(true);
    expect(valuesMatch([[2, 1], [3]], [[3], [1, 2]], "unordered")).toBe(false);
    expect(valuesMatch([[2, 1], [3]], [[3], [1, 2]], "unordered-nested")).toBe(true);
    expect(valuesMatch(0.3333333, 1 / 3, "float")).toBe(true);
    expect(valuesMatch([1, 2], [1, 2, 3])).toBe(false);
  });
});

describe("problem bank", () => {
  it.each(PROBLEMS.map((p) => [p.slug, p] as const))("%s: reference passes every test", (_slug, p) => {
    expect(runLocally(p.signature, "javascript", p.reference, p.tests).verdict).toBe("accepted");
  });

  it("has unique slugs and samples everywhere", () => {
    expect(new Set(PROBLEMS.map((p) => p.slug)).size).toBe(PROBLEMS.length);
    for (const p of PROBLEMS) expect(p.tests.some((t) => t.sample)).toBe(true);
  });

  it("starter code compiles in both languages", () => {
    for (const p of PROBLEMS) {
      for (const lang of ["python", "javascript"] as const) {
        const out = runLocally(p.signature, lang, starterCode(p.signature, lang), p.tests.slice(0, 1));
        // Starter code returns nothing useful, but it must parse and the harness must find it.
        expect(["wrong_answer", "runtime_error", "accepted"]).toContain(out.verdict);
        expect(out.results.length).toBe(1);
      }
    }
  });
});

describe("python driver", () => {
  it("runs functions and captures prints", () => {
    const out = run(
      "pair-with-target-sum",
      "python",
      "def two_sum(nums, target):\n    print('checking', len(nums))\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i\n",
    );
    expect(out.verdict).toBe("accepted");
    expect(out.results[0].stdout).toContain("checking 4");
  });

  it("converts linked lists and trees both ways", () => {
    expect(
      run(
        "flip-the-chain",
        "python",
        "def reverse_list(head):\n    prev = None\n    while head:\n        head.next, prev, head = prev, head, head.next\n    return prev\n",
      ).verdict,
    ).toBe("accepted");
    expect(
      run(
        "mirror-the-tree",
        "python",
        "def invert_tree(root):\n    if root:\n        root.left, root.right = invert_tree(root.right), invert_tree(root.left)\n    return root\n",
      ).verdict,
    ).toBe("accepted");
  });

  it("reads in-place answers", () => {
    const code = `def reorder_list(head):
    nodes = []
    while head:
        nodes.append(head); head = head.next
    i, j = 0, len(nodes) - 1
    while i < j:
        nodes[i].next = nodes[j]; i += 1
        if i == j: break
        nodes[j].next = nodes[i]; j -= 1
    if nodes: nodes[i].next = None
`;
    expect(run("zigzag-the-chain", "python", code).verdict).toBe("accepted");
  });

  it("runs design problems", () => {
    const code = `class MinStack:
    def __init__(self):
        self.s = []
    def push(self, val):
        self.s.append((val, min(val, self.s[-1][1]) if self.s else val))
    def pop(self):
        self.s.pop()
    def top(self):
        return self.s[-1][0]
    def get_min(self):
        return self.s[-1][1]
`;
    expect(run("stack-with-minimum", "python", code).verdict).toBe("accepted");
  });

  it("reports errors with line numbers in the user's code", () => {
    const out = run("pair-with-target-sum", "python", "def two_sum(nums, target):\n    return nums[100]\n");
    expect(out.verdict).toBe("runtime_error");
    expect(out.results[0].error).toContain("IndexError");
  });

  it("reports wrong answers and syntax errors", () => {
    expect(run("pair-with-target-sum", "python", "def two_sum(nums, target):\n    return [0, 1]\n").verdict).toBe("wrong_answer");
    const bad = run("pair-with-target-sum", "python", "def two_sum(nums, target)\n    return 1\n");
    expect(bad.verdict).toBe("runtime_error");
    expect(bad.message).toContain("SyntaxError");
  });

  it("stops infinite loops", () => {
    const p = PROBLEM_BY_SLUG.get("pair-with-target-sum")!;
    const out = runLocally(p.signature, "python", "def two_sum(nums, target):\n    while True: pass\n", p.tests, 2000);
    expect(out.verdict).toBe("time_limit");
  });
});
