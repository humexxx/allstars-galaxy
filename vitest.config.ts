import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    // node by default (service/action tests); component files opt into jsdom
    // with `// @vitest-environment jsdom` at the top.
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    // Skip the Playwright e2e tree — Playwright owns those.
    exclude: ["node_modules", "e2e", ".next"],
    css: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
