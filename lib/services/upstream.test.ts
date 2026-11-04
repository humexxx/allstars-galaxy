import { describe, expect, it, vi } from "vitest";

import { cachedFeed, rateLimiter } from "./upstream";

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

describe("rateLimiter", () => {
  it("lets four through at once and holds the rest until the window has passed", async () => {
    vi.useFakeTimers();
    try {
      const slot = rateLimiter(4, 1_000);
      const started: number[] = [];
      const t0 = Date.now();
      const calls = Array.from({ length: 6 }, () =>
        slot().then(() => started.push(Date.now() - t0))
      );
      await vi.advanceTimersByTimeAsync(999);
      expect(started).toEqual([0, 0, 0, 0]);
      await vi.advanceTimersByTimeAsync(1);
      await Promise.all(calls);
      expect(started).toEqual([0, 0, 0, 0, 1_000, 1_000]);
    } finally {
      vi.useRealTimers();
    }
  });
});
