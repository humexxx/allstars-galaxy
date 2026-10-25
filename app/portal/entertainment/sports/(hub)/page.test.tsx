import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/services/impersonation", () => ({ requireEffectiveContext: vi.fn() }));
vi.mock("@/components/entertainment/sports/sports-hub", () => ({ SportsHub: () => null }));

import { generateMetadata } from "./page";

const titleFor = async (params: { sport?: string; league?: string }): Promise<unknown> =>
  (await generateMetadata({ searchParams: Promise.resolve(params) })).title;

describe("the sports hub's title", () => {
  it("names the sport on screen, so a switch changes it and Next announces it", async () => {
    expect(await titleFor({ sport: "nba" })).toBe("NBA · Sports");
    expect(await titleFor({ sport: "f1" })).toBe("Formula 1 · Sports");
  });

  it("names football's competition, the first league when the URL names none", async () => {
    expect(await titleFor({ sport: "football", league: "la-liga" })).toBe("LaLiga · Sports");
    expect(await titleFor({ sport: "football" })).toBe("UEFA Champions League · Sports");
    expect(await titleFor({ sport: "worldcup" })).toBe("FIFA World Cup 2026 · Sports");
  });

  it("stays Sports when the URL names no sport, rather than reading the favourites", async () => {
    expect(await titleFor({})).toBe("Sports");
    expect(await titleFor({ sport: "curling" })).toBe("Sports");
  });
});
