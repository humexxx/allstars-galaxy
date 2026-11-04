import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieValue = vi.fn<() => string | undefined>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "tz" && cookieValue() ? { value: cookieValue() } : undefined),
  }),
}));

import { getRequestTimeZone, getRequestTodayIso, readRequestTimeZone } from "./request-today";

beforeEach(() => {
  cookieValue.mockReset();
});

describe("readRequestTimeZone", () => {
  it("is the cookie's zone", async () => {
    cookieValue.mockReturnValue("America/Costa_Rica");
    expect(await readRequestTimeZone()).toBe("America/Costa_Rica");
  });

  it("is null before the browser has written one, and for a zone Intl does not know", async () => {
    expect(await readRequestTimeZone()).toBeNull();
    cookieValue.mockReturnValue("Mars/Olympus_Mons");
    expect(await readRequestTimeZone()).toBeNull();
  });
});

describe("getRequestTimeZone", () => {
  it("falls back to UTC without a usable cookie", async () => {
    expect(await getRequestTimeZone()).toBe("UTC");
  });
});

describe("getRequestTodayIso", () => {
  // 8 pm on Monday in Costa Rica: already Tuesday in UTC.
  const evening = new Date("2026-10-20T02:00:00Z");

  it("is the reader's day", async () => {
    cookieValue.mockReturnValue("America/Costa_Rica");
    expect(await getRequestTodayIso(evening)).toBe("2026-10-19");
  });

  it("is UTC's day — tomorrow, here — before the cookie exists", async () => {
    expect(await getRequestTodayIso(evening)).toBe("2026-10-20");
  });
});
