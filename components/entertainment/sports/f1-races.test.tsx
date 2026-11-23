// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { F1Data, F1WeekendResults } from "@/types/sports";

import { F1_SEASON } from "./__fixtures__/f1";
import { F1Races } from "./f1-races";

function renderRaces(data: F1Data = F1_SEASON, weekend?: F1WeekendResults, justRunRound?: number): void {
  render(
    <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
      <F1Races data={data} weekend={weekend} justRunRound={justRunRound} />
    </ReaderTimeZoneProvider>
  );
}

const featuredCard = (): HTMLElement =>
  screen.getByRole("heading", { name: "United States Grand Prix" }).closest('[data-slot="card"]')!;

const section = (title: string): HTMLElement =>
  screen.getByRole("heading", { name: title }).closest("section")!;
// The races, not the pill on the section's heading.
const tiles = (title: string): HTMLElement[] =>
  within(section(title))
    .queryAllByRole("link")
    .filter((b) => b.hasAttribute("data-race"));
const rounds = (title: string): string[] =>
  tiles(title).map((t) => t.textContent?.match(/Round (\d+)/)?.[1] ?? "");
// The latest race run is there from the start; the rest come in from the pill, three a tap.
const showEarlier = (): void => {
  fireEvent.click(within(section("Earlier races")).getByRole("button", { name: /^Earlier:/ }));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // Monday before Austin, 06:00 in Costa Rica.
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("F1Races", () => {
  it("leads with the next race, in the reader's zone, and what its weekend runs next", () => {
    renderRaces();
    const featured = featuredCard();

    // "Next race" is the heading above the card, which names the round; the
    // race's name is a level under it.
    expect(within(featured.closest("section")!).getByRole("heading", { level: 2 })).toHaveTextContent("Next race");
    expect(within(featured).getByRole("heading", { level: 3 })).toHaveTextContent("United States Grand Prix");
    expect(featured).toHaveTextContent(/^Round 18/);
    expect(featured.querySelector('[data-slot="badge"]')).toHaveTextContent("Sprint");
    expect(featured).toHaveTextContent("Circuit of the Americas · Austin, USA");
    // 20:00Z is 2 PM in Costa Rica.
    expect(featured).toHaveTextContent("Sun, Oct 25, 2:00 PM");
    expect(featured).toHaveTextContent("Practice 1 in 4d");
    const sessions = within(featured).getAllByRole("listitem");
    expect(sessions.map((li) => li.firstElementChild?.textContent)).toEqual([
      "Practice 1Next",
      "Sprint Qualifying",
      "Sprint",
      "Qualifying",
      "Race",
    ]);
  });

  it("calls a race weekend under way, with the session on track", () => {
    vi.setSystemTime(new Date("2026-10-24T17:20:00Z"));
    renderRaces();
    const featured = featuredCard();
    expect(within(featured).getByText("Sprint live")).toBeInTheDocument();
  });

  it("calls a race weekend between its sessions, in words that read on the badge's tint", () => {
    // After Practice 1, before Sprint Qualifying.
    vi.setSystemTime(new Date("2026-10-23T20:00:00Z"));
    renderRaces();
    const badge = within(featuredCard()).getByText("Race weekend");
    expect(badge).toHaveAttribute("data-variant", "info");
    expect(badge).toHaveClass("text-foreground");
    expect(within(featuredCard()).getByText("Next")).toHaveClass("text-foreground");
  });

  it("lists every race after it under Coming up, and only the latest one run until asked for", () => {
    renderRaces();
    expect(tiles("Coming up").map((t) => within(t).getByText(/Grand Prix$/).textContent)).toEqual([
      "Mexico City Grand Prix",
      "São Paulo Grand Prix",
      "Las Vegas Grand Prix",
      "Qatar Grand Prix",
    ]);
    expect(screen.queryByRole("heading", { name: "Just finished" })).toBeNull();
    // The race just run shows its winner without a tap.
    expect(rounds("Earlier races")).toEqual(["17"]);
    expect(tiles("Earlier races")[0]).toHaveTextContent(/WinnerVER/);
    expect(
      within(section("Earlier races")).getByRole("button", { name: "Earlier: Show rounds 14 – 16" })
    ).toBeInTheDocument();
  });

  it("brings in the three before it, latest first, with winner, pole and fastest lap", () => {
    renderRaces();
    showEarlier();
    const [singapore, baku, monza] = tiles("Earlier races");
    expect(within(singapore).getByText("Singapore Grand Prix")).toBeInTheDocument();
    expect(within(baku).getByText("Azerbaijan Grand Prix")).toBeInTheDocument();
    expect(within(monza).getByText("Italian Grand Prix")).toBeInTheDocument();
    expect(tiles("Earlier races")).toHaveLength(4);

    // Winner VER, pole RUS, fastest lap LEC — each named for a screen reader.
    expect(singapore).toHaveTextContent(/WinnerVER/);
    expect(singapore).toHaveTextContent(/PoleRUS/);
    expect(singapore).toHaveTextContent(/Fastest lapLEC/);
  });

  it("brings in earlier races below the ones shown, until the season has none left", () => {
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    renderRaces();
    expect(rounds("Earlier races")).toEqual(["17"]);

    fireEvent.click(screen.getByRole("button", { name: "Earlier: Show rounds 14 – 16" }));

    expect(rounds("Earlier races")).toEqual(["17", "16", "15", "14"]);
    // Nothing older: the pill goes, and the keyboard lands on the first race it brought in.
    expect(screen.queryByRole("button", { name: /^Earlier:/ })).toBeNull();
    expect(document.activeElement).toBe(tiles("Earlier races")[1]);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("keeps the pill, focused, while there are more races that way", () => {
    const long: F1Data = {
      ...F1_SEASON,
      races: [
        ...[8, 9, 10, 11, 12, 13].map((round) => ({
          ...F1_SEASON.races[0],
          id: `r-${round}`,
          round,
          name: `Round ${round} Grand Prix`,
        })),
        ...F1_SEASON.races,
      ],
    };
    renderRaces(long);
    showEarlier();

    fireEvent.click(screen.getByRole("button", { name: "Earlier: Show rounds 11 – 13" }));

    expect(rounds("Earlier races")).toEqual(["17", "16", "15", "14", "13", "12", "11"]);
    const pill = screen.getByRole("button", { name: "Earlier: Show rounds 8 – 10" });
    expect(document.activeElement).toBe(pill);
  });

  it("opens every race on its own page, by its round", () => {
    renderRaces();
    expect(tiles("Earlier races")[0]).toHaveAttribute("href", "/portal/entertainment/sports/f1/17");
    expect(within(section("Coming up")).getByRole("link", { name: /Qatar Grand Prix/ })).toHaveAttribute(
      "href",
      "/portal/entertainment/sports/f1/22"
    );
  });

  it("opens the featured race's page from View details; the card itself is not a link and does not grey", () => {
    renderRaces();
    expect(featuredCard().className).not.toMatch(/hover:bg/);
    expect(screen.queryByRole("link", { name: "United States Grand Prix" })).toBeNull();

    const details = screen.getByRole("link", { name: "View details: United States Grand Prix" });
    // At the card's foot, on its right.
    expect(details.parentElement).toHaveClass("col-span-2", "justify-end");
    expect(details).toHaveAttribute("href", "/portal/entertainment/sports/f1/18");
  });

  it("shows who led each session run so far in the card's timetable, by face", () => {
    vi.setSystemTime(new Date("2026-10-24T03:00:00Z"));
    // Leclerc has a face in the standings; Norris has none, so his disc is his code.
    const drivers = F1_SEASON.drivers.map((d) =>
      d.code === "LEC" ? { ...d, imageUrl: "https://a.espncdn.com/i/headshots/rpm/players/full/5498.png" } : d
    );
    renderRaces({ ...F1_SEASON, drivers }, {
      season: 2026,
      round: 18,
      sessions: [
        {
          kind: "fp1",
          rows: [
            { position: "1", code: "LEC", name: "C. Leclerc", team: "Ferrari", teamColor: "#E8002D", time: "1:36.052" },
            { position: "2", code: "VER", name: "M. Verstappen", team: "Red Bull Racing", time: "1:36.120", gap: "+0.068" },
          ],
        },
        { kind: "sprint-qualifying", rows: [{ position: "1", code: "NOR", name: "L. Norris", team: "McLaren", time: "1:33.200", segment: "Q3" }] },
      ],
    });
    const rows = within(featuredCard()).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent(/^Practice 1Fastest:C. Leclerc1:36.052$/);
    expect(rows[0].querySelector("img")).not.toBeNull();
    expect(rows[1]).toHaveTextContent(/^Sprint QualifyingSprint pole:NORL. Norris1:33.200$/);
    expect(rows[1].querySelector("img")).toBeNull();
    // Still to run: its time, not a result.
    expect(rows[2]).toHaveTextContent("Sprint");
    expect(rows[2]).not.toHaveTextContent("Winner");
  });

  it("says the season is over when nothing is left to run", () => {
    const over: F1Data = {
      ...F1_SEASON,
      races: F1_SEASON.races.filter((r) => r.status === "completed"),
    };
    renderRaces(over);
    expect(screen.getByText("The 2026 season is over")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Coming up" })).toBeNull();
    // With nothing to come, the latest races run are there from the start.
    expect(rounds("Earlier races")).toEqual(["17", "16", "15"]);
    expect(screen.getByRole("button", { name: "Earlier: Show round 14" })).toBeInTheDocument();
  });

  it("leads with the race just run, its result in, until the reader moves on to the next", () => {
    renderRaces(F1_SEASON, undefined, 17);

    const lead = screen.getByRole("heading", { name: "Just run" }).closest("section")!;
    expect(within(lead).getByRole("heading", { level: 3 })).toHaveTextContent("Singapore Grand Prix");
    expect(within(lead).getByText("Winner")).toBeInTheDocument();
    // Not twice: the race leading is not also the first of the earlier ones.
    expect(rounds("Earlier races")).toEqual(["16"]);
    // The next race waits first in line under Coming up.
    expect(rounds("Coming up")[0]).toBe("18");

    fireEvent.click(within(lead).getByRole("button", { name: /Next race/ }));
    expect(screen.getByRole("heading", { name: "Next race" })).toBeInTheDocument();
    expect(within(featuredCard()).getByRole("heading", { level: 3 })).toHaveTextContent("United States Grand Prix");
    expect(rounds("Coming up")[0]).toBe("19");
    expect(rounds("Earlier races")).toEqual(["17"]);

    fireEvent.click(screen.getByRole("button", { name: /Back to Singapore Grand Prix/ }));
    expect(screen.getByRole("heading", { name: "Just run" })).toBeInTheDocument();
  });
});
