import "server-only";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import * as schema from "./schema";

// Postgres when DATABASE_URL is set (Supabase, Neon, local Postgres);
// otherwise an embedded Postgres (PGlite) stored in ./.data so the app runs
// with no setup.

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const migrationsFolder = path.join(process.cwd(), "drizzle");

function create(): { db: DB; migrate: () => Promise<void> } {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { max: 10 });
    const db = drizzlePostgres(client, { schema });
    return { db: db as unknown as DB, migrate: () => migratePostgres(db, { migrationsFolder }) };
  }
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  return { db: db as unknown as DB, migrate: () => migratePglite(db, { migrationsFolder }) };
}

// Reuse one connection across hot reloads in development, and open it lazily
// so build workers that never query don't each open the embedded database.
const g = globalThis as unknown as { __ipdb?: ReturnType<typeof create>; __ipdbReady?: Promise<void> };
const instance = () => (g.__ipdb ??= create());

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const real = instance().db as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/** Applies pending migrations once per process. */
export function ensureMigrated(): Promise<void> {
  return (g.__ipdbReady ??= instance().migrate());
}

export { schema };
