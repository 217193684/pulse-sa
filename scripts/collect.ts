/** Run one collection pass from the command line: npm run collect */
try { process.loadEnvFile(process.env.ENV_FILE ?? ".env"); } catch { /* real env vars only */ }

async function main() {
  const { collectAll } = await import("../src/server/collect");
  const { closeDb } = await import("../src/server/db");
  for (const r of await collectAll()) console.log(`${r.ok ? "✓" : "✗"} ${r.source}: fetched ${r.fetched}, new ${r.inserted}${r.errors.length ? ` — ${r.errors.join("; ")}` : ""}`);
  await closeDb();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
export {};
