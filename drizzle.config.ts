import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load .env
const { parsed } = dotenv.config({ path: ".env" });

// Migrations need a direct (session-mode) connection. Supabase's pooler on port
// 6543 is PgBouncer in transaction mode and silently hangs on multi-statement DDL.
// Prefer DIRECT_URL; fall back to DATABASE_URL only if it is not pointing at 6543.
const directUrl = parsed?.DIRECT_URL || process.env.DIRECT_URL;
const databaseUrl = parsed?.DATABASE_URL || process.env.DATABASE_URL;
const url = directUrl || databaseUrl;

if (!url) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set in .env");
}

if (!directUrl && url.includes(":6543/")) {
  throw new Error(
    [
      "",
      "Your DATABASE_URL points to the Supabase pooler on port 6543 (transaction mode).",
      "That endpoint does not support multi-statement DDL and will hang silently on migrations.",
      "",
      "Add DIRECT_URL to your .env using the SESSION pooler endpoint (port 5432).",
      "It is the same URL as DATABASE_URL but with :5432 instead of :6543.",
      "",
      "Example:",
      "  DATABASE_URL=postgresql://postgres.xxx:****@aws-1-us-east-2.pooler.supabase.com:6543/postgres",
      "  DIRECT_URL=postgresql://postgres.xxx:****@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
      "",
    ].join("\n")
  );
}

console.log("--- Drizzle Config ---");
console.log("Using URL:", url.replace(/:([^:@]+)@/, ":****@"));
console.log("Source:", directUrl ? "DIRECT_URL" : "DATABASE_URL");
console.log("----------------------");

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
