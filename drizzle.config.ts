import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load .env
const { parsed } = dotenv.config({ path: ".env" });

// Migrations and schema introspection need a direct (session-mode) connection.
// Supabase's pooler on port 6543 is PgBouncer in transaction mode and breaks
// multi-statement DDL. Prefer DIRECT_URL when present; fall back to DATABASE_URL
// for local Postgres setups that don't need a pooler.
const databaseUrl =
  parsed?.DIRECT_URL ||
  process.env.DIRECT_URL ||
  parsed?.DATABASE_URL ||
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set in .env");
}

console.log("--- Drizzle Config ---");
console.log("Using Database URL:", databaseUrl.replace(/:([^:@]+)@/, ":****@"));
console.log("----------------------");

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
