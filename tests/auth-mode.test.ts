import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { authMode } from "@/lib/auth/mode";

const saved = { AUTH_MODE: process.env.AUTH_MODE, VERCEL: process.env.VERCEL };
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("auth mode", () => {
  it("is single-user locally and accounts on Vercel unless set", () => {
    delete process.env.AUTH_MODE;
    delete process.env.VERCEL;
    expect(authMode()).toBe("single");
    process.env.VERCEL = "1";
    expect(authMode()).toBe("accounts");
    process.env.AUTH_MODE = "Single";
    expect(authMode()).toBe("single");
    delete process.env.VERCEL;
    process.env.AUTH_MODE = "accounts";
    expect(authMode()).toBe("accounts");
  });
});

describe("single-user mode", () => {
  beforeAll(() => {
    process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "auth-db-"));
  });

  it("signs everyone in as one user, reusing an existing account", async () => {
    delete process.env.AUTH_MODE;
    delete process.env.VERCEL;
    vi.resetModules();
    const { getCurrentUser } = await import("@/lib/auth/session");
    const first = await getCurrentUser();
    expect(first).toMatchObject({ id: "local-user", name: "Me" });

    // A database that already has an account (made before single-user mode)
    // keeps using it, so earlier progress carries over.
    const { db, schema } = await import("@/lib/db");
    await db.delete(schema.user);
    await db.insert(schema.user).values({ id: "u-old", name: "Jason", email: "jason@example.com" });
    (globalThis as { __ipLocalUser?: unknown }).__ipLocalUser = undefined;
    vi.resetModules();
    const again = await import("@/lib/auth/session");
    expect(await again.getCurrentUser()).toMatchObject({ id: "u-old", name: "Jason" });
  });
});
