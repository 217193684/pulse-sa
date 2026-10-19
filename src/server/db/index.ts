import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type DB = NodePgDatabase<typeof schema>;
const g = globalThis as unknown as { __pulsePool?: Pool; __pulseDb?: DB };

/** The database, created on first use (so builds and tests can set DATABASE_URL first). */
export function db(): DB {
  if (!g.__pulseDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    g.__pulsePool = new Pool({
      connectionString: url,
      max: Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? 3 : 5)),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
    });
    g.__pulseDb = drizzle(g.__pulsePool, { schema });
  }
  return g.__pulseDb;
}

export async function closeDb() {
  await g.__pulsePool?.end();
  g.__pulsePool = undefined;
  g.__pulseDb = undefined;
}

export { schema };
