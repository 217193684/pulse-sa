/** Test bootstrap: use the dedicated test database, migrate, and start each file empty. */
import { beforeAll } from "vitest";
try { process.loadEnvFile(".env.test"); } catch { /* CI sets TEST_DATABASE_URL directly */ }
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

beforeAll(async () => {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { db } = await import("../src/server/db");
  const { sql } = await import("drizzle-orm");
  await migrate(db(), { migrationsFolder: "./drizzle" });
  await db().execute(sql`truncate table signals, collector_runs, videos, status`);
});
