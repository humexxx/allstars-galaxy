import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// `server-only` is a Next.js marker package that throws at build time when
// imported from the client bundle. In Vitest we are deliberately running
// server modules in a Node environment, so we stub it out globally.
vi.mock("server-only", () => ({}));

// `unstable_cache` needs Next's incremental cache, which isn't initialised in
// Vitest. Treat it as a no-op so cached wrappers invoke their inner function
// directly. Individual tests can still stub `global.fetch` per-call.
vi.mock("next/cache", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("next/cache");
  return {
    ...actual,
    unstable_cache: <Args extends unknown[], Ret>(fn: (...args: Args) => Ret) => fn,
  };
});

// External-API services (lolesports, jolpica, …) all wrap `fetch` with a
// try/catch that falls back to mock fixtures. Reject `fetch` by default so the
// test suite exercises the fallback path and stays hermetic. Individual tests
// that need real or stubbed responses can override `global.fetch` themselves.
if (typeof global.fetch === "function") {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("fetch is disabled in unit tests"))),
  );
}
