import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres"; // 
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
const url = connectionString.includes('?') ? `${connectionString}&sslmode=require` : `${connectionString}?sslmode=require`;

console.log("🔌 Connecting to DB at:", url.replace(/:[^:@]+@/, ":****@"));

// `prepare: false` — prepared statements aren't supported in "Transaction" pool
// mode. The timeouts recycle connections so a stale/half-open pooled connection
// (a Supabase pooler/network blip on a long-idle conn) doesn't make the next
// query hang until the server statement_timeout (~8s) fires — the symptom being
// a trivial query like the portal's user-role lookup "canceling statement due to
// statement timeout".
export const client = postgres(url, {
  prepare: false,
  idle_timeout: 20, // drop a connection after 20s idle (recycles stale ones)
  max_lifetime: 60 * 30, // hard-recycle any connection after 30 min
  connect_timeout: 10, // fail fast on connect instead of hanging
});
export const db = drizzle(client, { schema });
