// Thin wrapper that boots @modelcontextprotocol/server-postgres with the project's
// DIRECT_URL from .env, so the password never has to live inside .mcp.json (which
// is committed). Invoked by .mcp.json on session start.
import { spawn } from "node:child_process";

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("[mcp-postgres] DIRECT_URL is missing from .env — server cannot start.");
  process.exit(1);
}

if (url.includes(":6543/")) {
  console.error(
    "[mcp-postgres] DIRECT_URL points at the transaction pooler (:6543). " +
      "Use the session pooler (:5432) instead — see CLAUDE.md."
  );
  process.exit(1);
}

const child = spawn(
  "npx",
  ["-y", "@modelcontextprotocol/server-postgres", url],
  { stdio: "inherit" }
);

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("[mcp-postgres] Failed to spawn server:", err);
  process.exit(1);
});
