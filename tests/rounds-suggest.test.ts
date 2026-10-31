import { describe, expect, it } from "vitest";
import { suggestRounds, type SuggestInput } from "@/lib/rounds/suggest";

const now = new Date("2026-11-01T12:00:00Z");
const base: SuggestInput = { level: "mid", daysLeft: 60, targets: [], loops: {}, history: [], built: ["design", "behavioral", "walkthrough"], now };
const kinds = (i: Partial<SuggestInput>) => suggestRounds({ ...base, ...i }).map((s) => s.kind);
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("round suggestions", () => {
  it("stays quiet far from the interview for a mid-level candidate", () => {
    expect(kinds({})).toEqual([]);
  });

  it("suggests design and behavioral as the interview gets close, but not again within a week", () => {
    expect(kinds({ daysLeft: 20 })).toEqual(["design", "behavioral"]);
    expect(kinds({ daysLeft: 20, history: [{ kind: "design", last: daysAgo(3), focus: null }] })).toEqual(["behavioral"]);
  });

  it("keeps design in a senior candidate's week, and skips it for new grads unless the loop has one", () => {
    expect(kinds({ level: "senior" })).toContain("design");
    expect(kinds({ level: "new-grad", daysLeft: 20 })).not.toContain("design");
    expect(kinds({ level: "new-grad", daysLeft: 20, targets: ["google"], loops: { google: "Two coding rounds and a system design round." } })).toContain("design");
  });

  it("uses company loops and known formats", () => {
    expect(kinds({ targets: ["amazon"] })).toContain("behavioral");
    expect(kinds({ targets: ["acme"], loops: { acme: "A take-home followed by a walkthrough." } })).toContain("walkthrough");
    expect(kinds({ daysLeft: 10 })).toContain("walkthrough");
  });

  it("only suggests kinds that are built, and carries the last focus area", () => {
    const focus = { area: "tradeoffs", title: "Name the alternative", why: "", drill: "Say X instead of Y because..." };
    const out = suggestRounds({ ...base, built: ["design"], daysLeft: 10, history: [{ kind: "design", last: daysAgo(9), focus }] });
    expect(out).toEqual([{ kind: "design", reason: expect.any(String), focus }]);
  });
});
