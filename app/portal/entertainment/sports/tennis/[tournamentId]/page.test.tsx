import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sports/detail", () => ({ loadRacquetTournament: vi.fn() }));
vi.mock("@/lib/services/impersonation", () => ({ requireEffectiveContext: vi.fn() }));
vi.mock("@/lib/services/sports-service", () => ({ listUserFavoriteSportIds: vi.fn() }));
vi.mock("@/components/entertainment/sports/sports/racquet-tournament-page", () => ({
  RacquetTournamentPage: () => null,
}));

import { loadRacquetTournament } from "@/lib/sports/detail";

import { generateMetadata } from "./page";

type Detail = Awaited<ReturnType<typeof loadRacquetTournament>>;

const titleFor = async (tournamentId: string): Promise<unknown> =>
  (await generateMetadata({ params: Promise.resolve({ tournamentId }), searchParams: Promise.resolve({}) }))
    .title;

describe("a tennis tournament's title", () => {
  it("is the tournament's name", async () => {
    vi.mocked(loadRacquetTournament).mockResolvedValue({ tournament: { name: "Milano P1" } } as Detail);
    expect(await titleFor("milano")).toBe("Milano P1");
  });

  it("says the tournament is missing, not just the sport, on the not-found page", async () => {
    vi.mocked(loadRacquetTournament).mockResolvedValue(null);
    expect(await titleFor("gone")).toBe("Not on this season's calendar");
  });
});
