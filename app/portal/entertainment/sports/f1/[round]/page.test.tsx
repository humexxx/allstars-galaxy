import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sports/detail", () => ({ loadF1Race: vi.fn() }));
vi.mock("@/lib/services/impersonation", () => ({ requireEffectiveContext: vi.fn() }));
vi.mock("@/lib/services/sports-service", () => ({ listUserFavoriteSportIds: vi.fn() }));
vi.mock("@/components/entertainment/sports/f1-race-page", () => ({ F1RacePage: () => null }));

import { loadF1Race } from "@/lib/sports/detail";

import { generateMetadata } from "./page";

type Detail = Awaited<ReturnType<typeof loadF1Race>>;

const titleFor = async (round: string): Promise<unknown> =>
  (await generateMetadata({ params: Promise.resolve({ round }), searchParams: Promise.resolve({}) })).title;

describe("a race's title", () => {
  it("is the race's name", async () => {
    vi.mocked(loadF1Race).mockResolvedValue({ race: { name: "United States Grand Prix" } } as Detail);
    expect(await titleFor("19")).toBe("United States Grand Prix");
  });

  it("says the race is missing, not just Formula 1, on the not-found page", async () => {
    vi.mocked(loadF1Race).mockResolvedValue(null);
    expect(await titleFor("19")).toBe("Not on this season's calendar");
    expect(await titleFor("not-a-round")).toBe("Not on this season's calendar");
  });
});
