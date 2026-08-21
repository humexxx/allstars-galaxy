import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

// Unmount rendered components between tests. Vitest only auto-cleans when
// `globals: true`, and this project runs with explicit imports — so without
// this every render in a file stacks up in the same document and `screen`
// queries match elements from earlier tests. The failure mode is nasty: a
// passing assertion silently reads the PREVIOUS test's DOM, and negative
// assertions ("this value is masked") fail against markup that is no longer
// on screen. Only applies to jsdom files; Node-environment tests skip it.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

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

// jsdom ships no ResizeObserver, and components that measure their own text
// (MarqueeText) observe one. A no-op keeps them mountable; the tests that care
// about the measurement stage the widths themselves.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
