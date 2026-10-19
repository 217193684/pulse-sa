import { defineConfig } from "drizzle-kit";
try { process.loadEnvFile(".env"); } catch {}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost/pulse" },
  strict: true,
});
