import { describe, expect, it } from "vitest";
import { endOfDayIn } from "@/lib/engine/day";
import { matchImported } from "@/lib/problems/import";

describe("LeetCode import", () => {
  it("matches links exactly, so a II problem doesn't mark the original", () => {
    expect(matchImported("https://leetcode.com/problems/meeting-rooms-ii/")).toEqual(["conference-rooms-needed"]);
    expect(matchImported("https://leetcode.com/problems/meeting-rooms/description/")).toEqual(["no-double-booking"]);
  });

  it("matches titles, numbered titles and bare slugs", () => {
    expect(matchImported("252. Meeting Rooms")).toEqual(["no-double-booking"]);
    expect(matchImported("Meeting Rooms II\nmeeting-rooms").sort()).toEqual(["conference-rooms-needed", "no-double-booking"]);
    expect(matchImported("meeting rooms 3, not a problem")).toEqual([]);
  });
});

describe("day math", () => {
  it("finds the end of the local day across zones", () => {
    expect(endOfDayIn(new Date("2026-10-12T01:00:00Z"), "America/Los_Angeles").toISOString()).toBe("2026-10-12T06:59:59.999Z");
    expect(endOfDayIn(new Date("2026-10-12T01:00:00Z"), "UTC").toISOString()).toBe("2026-10-12T23:59:59.999Z");
    // DST ends in Los Angeles on Nov 1, 2026: that day has 25 hours.
    expect(endOfDayIn(new Date("2026-11-01T12:00:00Z"), "America/Los_Angeles").toISOString()).toBe("2026-11-02T07:59:59.999Z");
  });
});
