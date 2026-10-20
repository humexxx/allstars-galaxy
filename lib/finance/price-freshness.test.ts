import { describe, expect, it } from "vitest";

import {
  formatAgo,
  formatSpan,
  isQuoteCurrent,
  isQuoteOverdue,
  lastRunAtOrBefore,
  nextRunAfter,
  parseCronSchedule,
  planPriceRefresh,
  PRICE_REFRESH_COOLDOWN_MS,
} from "./price-freshness";

const DAILY = { minute: 30, hour: 0 };
const at = (iso: string): Date => new Date(iso);

describe("parseCronSchedule", () => {
  it("reads a daily and an hourly line", () => {
    expect(parseCronSchedule("30 0 * * *")).toEqual({ minute: 30, hour: 0 });
    expect(parseCronSchedule(" 5  * * * * ")).toEqual({ minute: 5, hour: null });
  });

  it("refuses what it cannot schedule rather than guessing", () => {
    for (const line of ["*/15 * * * *", "30 0 * * 1", "30 0,12 * * *", "60 0 * * *", "0 24 * * *", "30 0 * *"]) {
      expect(parseCronSchedule(line)).toBeNull();
    }
  });
});

describe("nextRunAfter / lastRunAtOrBefore", () => {
  it("finds today's run before it happens and tomorrow's after it", () => {
    expect(nextRunAfter(DAILY, at("2026-10-19T23:00:00Z"))).toEqual(at("2026-10-20T00:30:00Z"));
    expect(nextRunAfter(DAILY, at("2026-10-20T00:30:00Z"))).toEqual(at("2026-10-21T00:30:00Z"));
    expect(lastRunAtOrBefore(DAILY, at("2026-10-20T00:30:00Z"))).toEqual(at("2026-10-20T00:30:00Z"));
    expect(lastRunAtOrBefore(DAILY, at("2026-10-20T00:29:59Z"))).toEqual(at("2026-10-19T00:30:00Z"));
  });

  it("steps an hourly schedule by the hour", () => {
    const hourly = { minute: 30, hour: null };
    expect(nextRunAfter(hourly, at("2026-10-20T07:10:00Z"))).toEqual(at("2026-10-20T07:30:00Z"));
    expect(nextRunAfter(hourly, at("2026-10-20T07:45:00Z"))).toEqual(at("2026-10-20T08:30:00Z"));
    expect(nextRunAfter(hourly, at("2026-10-20T23:45:00Z"))).toEqual(at("2026-10-21T00:30:00Z"));
  });
});

describe("isQuoteCurrent", () => {
  it("keeps a daily close current for the rest of its UTC day", () => {
    const fetched = at("2026-10-20T00:30:44Z");
    expect(isQuoteCurrent("massive", fetched, at("2026-10-20T23:59:00Z"))).toBe(true);
    expect(isQuoteCurrent("massive", fetched, at("2026-10-21T00:00:00Z"))).toBe(false);
  });

  it("keeps a live quote current only for the cooldown", () => {
    const fetched = at("2026-10-20T12:00:00Z");
    const later = (ms: number): Date => new Date(fetched.getTime() + ms);
    expect(isQuoteCurrent("coingecko", fetched, later(PRICE_REFRESH_COOLDOWN_MS - 1))).toBe(true);
    expect(isQuoteCurrent("coingecko", fetched, later(PRICE_REFRESH_COOLDOWN_MS))).toBe(false);
  });

  it("never fetches a manual price, and always fetches one never quoted", () => {
    expect(isQuoteCurrent("manual", null, at("2026-10-20T12:00:00Z"))).toBe(true);
    expect(isQuoteCurrent("massive", null, at("2026-10-20T12:00:00Z"))).toBe(false);
  });
});

describe("planPriceRefresh", () => {
  const now = at("2026-10-20T15:00:00Z");

  it("asks only for prices that could come back newer", () => {
    const plan = planPriceRefresh(
      [
        { assetId: "ada", source: "massive", fetchedAt: at("2026-10-20T00:30:00Z") },
        { assetId: "spy", source: "massive", fetchedAt: at("2026-10-19T00:30:00Z") },
        { assetId: "new", source: "coingecko", fetchedAt: null },
        { assetId: "hand", source: "manual", fetchedAt: at("2026-01-01T00:00:00Z") },
      ],
      now
    );
    expect(plan.stale).toEqual(["spy", "new"]);
  });

  it("says when the earliest newer price can exist once everything is current", () => {
    const plan = planPriceRefresh(
      [
        { assetId: "ada", source: "massive", fetchedAt: at("2026-10-20T00:30:00Z") },
        { assetId: "btc", source: "coingecko", fetchedAt: at("2026-10-20T14:58:00Z") },
      ],
      now
    );
    expect(plan.stale).toEqual([]);
    expect(plan.newerAt).toEqual(at("2026-10-20T15:03:00Z"));

    const closesOnly = planPriceRefresh(
      [{ assetId: "ada", source: "massive", fetchedAt: at("2026-10-20T00:30:00Z") }],
      now
    );
    expect(closesOnly.newerAt).toEqual(at("2026-10-21T00:00:00Z"));
  });

  it("has nothing to say about a book priced only by hand", () => {
    expect(
      planPriceRefresh([{ assetId: "hand", source: "manual", fetchedAt: null }], now)
    ).toEqual({ stale: [], newerAt: null });
  });
});

describe("isQuoteOverdue", () => {
  const yesterdaysRun = at("2026-10-19T00:30:40Z");

  it("is not overdue while today's run may still be on its way", () => {
    // Hobby crons can start anywhere inside their hour.
    expect(isQuoteOverdue("massive", yesterdaysRun, DAILY, at("2026-10-20T01:15:00Z"))).toBe(false);
  });

  it("is overdue once today's run should have landed and didn't", () => {
    expect(isQuoteOverdue("massive", yesterdaysRun, DAILY, at("2026-10-20T01:31:00Z"))).toBe(true);
  });

  it("is not overdue when a refresh fetched today's close before the run", () => {
    expect(
      isQuoteOverdue("massive", at("2026-10-20T00:10:00Z"), DAILY, at("2026-10-20T03:00:00Z"))
    ).toBe(false);
  });
});

describe("formatAgo / formatSpan", () => {
  it("rounds down to the largest whole unit", () => {
    expect(formatAgo(20_000)).toBe("just now");
    expect(formatAgo(12 * 60_000 + 59_000)).toBe("12 min ago");
    expect(formatAgo(2 * 3_600_000 + 59 * 60_000)).toBe("2 h ago");
    expect(formatAgo(3 * 86_400_000)).toBe("3 d ago");
    expect(formatSpan(20_000)).toBe("1 min");
    expect(formatSpan(22 * 3_600_000 + 30 * 60_000)).toBe("22 h");
  });
});
