import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inviteOk } from "@/lib/auth/invite";
import { cronAuthorized } from "@/lib/cron";
import { checkEnv } from "@/lib/env";

const saved = { AUTH_MODE: process.env.AUTH_MODE, VERCEL: process.env.VERCEL, CRON_SECRET: process.env.CRON_SECRET };
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("production settings check", () => {
  const vercel = {
    NODE_ENV: "production",
    VERCEL: "1",
    DATABASE_URL: "postgres://x",
    BETTER_AUTH_SECRET: "x".repeat(44),
    BETTER_AUTH_URL: "https://app.example",
    CRON_SECRET: "c".repeat(64),
    SIGNUP_INVITE_CODE: "club",
  };

  it("passes a complete Vercel setup", () => {
    process.env.VERCEL = "1";
    delete process.env.AUTH_MODE;
    expect(checkEnv(vercel)).toEqual({ errors: [], warnings: [] });
  });

  it("stops on a missing database, auth secret or site address", () => {
    process.env.VERCEL = "1";
    delete process.env.AUTH_MODE;
    const { errors } = checkEnv({ ...vercel, DATABASE_URL: "", BETTER_AUTH_SECRET: "short", BETTER_AUTH_URL: "" });
    expect(errors.join(" ")).toMatch(/DATABASE_URL/);
    expect(errors.join(" ")).toMatch(/BETTER_AUTH_SECRET/);
    expect(errors.join(" ")).toMatch(/BETTER_AUTH_URL/);
  });

  it("warns about open sign-up, single-user mode and a missing cron secret", () => {
    process.env.VERCEL = "1";
    delete process.env.AUTH_MODE;
    expect(checkEnv({ ...vercel, SIGNUP_INVITE_CODE: "", CRON_SECRET: "" }).warnings.join(" ")).toMatch(/SIGNUP_INVITE_CODE[\s\S]*CRON_SECRET/);
    process.env.AUTH_MODE = "single";
    expect(checkEnv(vercel).warnings.join(" ")).toMatch(/AUTH_MODE=single/);
  });

  it("asks nothing of a local single-user setup", () => {
    delete process.env.VERCEL;
    delete process.env.AUTH_MODE;
    expect(checkEnv({ NODE_ENV: "development" })).toEqual({ errors: [], warnings: [] });
  });
});

describe("invite code", () => {
  it("is open when unset, and otherwise needs an exact match", () => {
    expect(inviteOk(null, null)).toBe(true);
    expect(inviteOk("club-2026", "club-2026")).toBe(true);
    expect(inviteOk(" club-2026 ", "club-2026")).toBe(true);
    expect(inviteOk("club-2025", "club-2026")).toBe(false);
    expect(inviteOk(null, "club-2026")).toBe(false);
  });
});

describe("cron jobs", () => {
  const req = (auth?: string) => new Request("http://x/api/cron/research", { headers: auth ? { authorization: auth } : {} });

  it("are off without CRON_SECRET and need the exact bearer token", () => {
    expect(cronAuthorized(req("Bearer anything"), undefined)).toBe(false);
    expect(cronAuthorized(req(), "s3cret")).toBe(false);
    expect(cronAuthorized(req("Bearer wrong!"), "s3cret")).toBe(false);
    expect(cronAuthorized(req("s3cret"), "s3cret")).toBe(false);
    expect(cronAuthorized(req("Bearer s3cret"), "s3cret")).toBe(true);
  });

  it("the research route refuses unauthorized calls without running anything", async () => {
    vi.resetModules();
    const runResearch = vi.fn();
    vi.doMock("@/lib/research", () => ({ runResearch }));
    process.env.CRON_SECRET = "s3cret";
    const { GET } = await import("@/app/api/cron/research/route");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(runResearch).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/research");
  });

  it("the retention route purges with the secret", async () => {
    vi.resetModules();
    const purgeExpired = vi.fn(async () => ({ mockSessions: 2, assistedSessions: 0, debugRounds: 1, rounds: 0 }));
    vi.doMock("@/lib/privacy", () => ({ purgeExpired, retentionDays: () => 90 }));
    process.env.CRON_SECRET = "s3cret";
    const { GET } = await import("@/app/api/cron/retention/route");
    expect((await GET(req())).status).toBe(401);
    expect(purgeExpired).not.toHaveBeenCalled();
    const res = await GET(req("Bearer s3cret"));
    expect(await res.json()).toEqual({ retentionDays: 90, purged: { mockSessions: 2, assistedSessions: 0, debugRounds: 1, rounds: 0 } });
    vi.doUnmock("@/lib/privacy");
  });

  it("vercel.json schedules both jobs", () => {
    const cfg = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as { crons: { path: string }[] };
    expect(cfg.crons.map((c) => c.path).sort()).toEqual(["/api/cron/research", "/api/cron/retention"]);
  });
});

describe(".env.example", () => {
  it("documents every environment variable the app reads, with empty values", () => {
    const example = readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    const vars = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=(.*)$/gm)];
    for (const [, name, value] of vars) expect(value, name).toBe("");
    const documented = new Set(vars.map((m) => m[1]));
    // Set by the platform, or only for tests.
    const platform = new Set(["NODE_ENV", "NEXT_RUNTIME", "VERCEL", "VERCEL_PROJECT_PRODUCTION_URL", "PGLITE_DIR"]);
    const used = new Set(
      execSync("git grep --untracked -hoE \"process\\.env\\.[A-Z_0-9]+\" -- src scripts evals", { encoding: "utf8" })
        .split("\n")
        .filter(Boolean)
        .map((l) => l.replace("process.env.", "")),
    );
    const missing = [...used].filter((v) => !platform.has(v) && !documented.has(v));
    expect(missing).toEqual([]);
  });
});
