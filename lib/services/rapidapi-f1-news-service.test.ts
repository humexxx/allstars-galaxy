import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: { insert: vi.fn() } }));

import { refreshF1News } from "./rapidapi-f1-news-service";

const ORIGINAL = process.env.RAPIDAPI_KEY;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.RAPIDAPI_KEY;
  else process.env.RAPIDAPI_KEY = ORIGINAL;
  vi.unstubAllGlobals();
});

describe("refreshF1News", () => {
  it("skips quietly when no key is configured — the feed is optional", async () => {
    delete process.env.RAPIDAPI_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(refreshF1News()).resolves.toEqual({ fetched: 0, stored: 0, skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
