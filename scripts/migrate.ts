/** Applies database migrations. Skips quietly when no database is configured (e.g. preview builds). */
try { process.loadEnvFile(process.env.ENV_FILE ?? ".env"); } catch { /* real env vars only */ }

async function main() {
  if (!process.env.DATABASE_URL) { console.log("No DATABASE_URL, skipping migrations"); return; }
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { db, closeDb } = await import("../src/server/db");
  await migrate(db(), { migrationsFolder: "./drizzle" });
  await closeDb();
  console.log("Database migrations applied");
}
main().catch((e) => { console.error("Migration failed:", e.message); process.exit(1); });
export {};
