import { describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config";

// Startup behaviour that only a real deploy fully shows (DEPLOY.md, "First
// deploy"); these check the parts that can be checked here.
describe("database startup", () => {
  it("retries a failed migration once", async () => {
    const { migrateWithRetry } = await import("@/lib/db");
    const flaky = vi.fn().mockRejectedValueOnce(new Error("relation already exists")).mockResolvedValue(undefined);
    await expect(migrateWithRetry(flaky, 0)).resolves.toBeUndefined();
    expect(flaky).toHaveBeenCalledTimes(2);
    const broken = vi.fn().mockRejectedValue(new Error("no database"));
    await expect(migrateWithRetry(broken, 0)).rejects.toThrow("no database");
    expect(broken).toHaveBeenCalledTimes(2);
  });

  it("doesn't remember a failed migration, so the next request tries again", { timeout: 20_000 }, async () => {
    const g = globalThis as unknown as { __ipdb?: unknown; __ipdbReady?: Promise<void> };
    const saved = { db: g.__ipdb, ready: g.__ipdbReady };
    const migrate = vi.fn().mockRejectedValueOnce(new Error("down")).mockRejectedValueOnce(new Error("still down")).mockResolvedValue(undefined);
    g.__ipdb = { db: {}, migrate };
    g.__ipdbReady = undefined;
    try {
      const { ensureMigrated } = await import("@/lib/db");
      await expect(ensureMigrated()).rejects.toThrow("still down");
      await expect(ensureMigrated()).resolves.toBeUndefined();
      expect(migrate).toHaveBeenCalledTimes(3);
      // And once it worked, it isn't run again.
      await ensureMigrated();
      expect(migrate).toHaveBeenCalledTimes(3);
    } finally {
      g.__ipdb = saved.db;
      g.__ipdbReady = saved.ready;
    }
  });

  it("ships the migration files with every server route", () => {
    // "/**" matches every route path, nested ones too ("/*" would only match one level).
    expect(nextConfig.outputFileTracingIncludes?.["/**"]).toContain("./drizzle/**/*");
  });
});
