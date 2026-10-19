import { describe, expect, it, vi } from "vitest";

import { cachedFeed } from "./upstream";

describe("cachedFeed", () => {
  it("returns the live answer when the provider gives one", async () => {
    const read = cachedFeed("test feed", async (n: number) => n * 2, () => -1, ["t"], {
      revalidate: 60,
    });
    await expect(read(21)).resolves.toBe(42);
  });

  it("falls back outside the cache when the provider fails", async () => {
    // The fallback must never be what the cache stores: a failed refresh has
    // to throw through `unstable_cache` so the last good entry survives it.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fallback = vi.fn((n: number) => -n);
    const read = cachedFeed(
      "test feed",
      (n: number): Promise<number> => Promise.reject(new Error(`429 on ${n}`)),
      fallback,
      ["t"],
      { revalidate: 60 }
    );
    await expect(read(3)).resolves.toBe(-3);
    expect(fallback).toHaveBeenCalledWith(3);
    warn.mockRestore();
  });
});
