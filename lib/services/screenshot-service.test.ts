import { afterEach, describe, expect, it, vi } from "vitest";

import { getScreenshotUrl } from "./screenshot-service";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getScreenshotUrl", () => {
  it("returns the screenshot microlink took", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: { screenshot: { url: "https://cdn/shot.png" } } })));
    expect(await getScreenshotUrl("https://one.test")).toBe("https://cdn/shot.png");
  });

  it("gives null on a failure, and leaves that url alone for an hour", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const now = Date.parse("2026-11-20T12:00:00Z");
    expect(await getScreenshotUrl("https://two.test", now)).toBeNull();
    expect(await getScreenshotUrl("https://two.test", now + 30 * 60_000)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await getScreenshotUrl("https://two.test", now + 61 * 60_000)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
