// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/sports", () => ({ setSportTeamFilterAction: vi.fn() }));

import { MLB_DATA } from "@/lib/data/sports/mlb";
import type { MlbData, NewsStory } from "@/types/sports";

import { SportsTodayProvider } from "../shared/time-zone-context";
import { MlbView } from "./mlb-view";

const REGULAR_SEASON: MlbData = { ...MLB_DATA, playoffs: [] };

/** The day the fixture's World Series is two games in; the reader's zone is UTC. */
function renderOn(data: MlbData, props: { news?: NewsStory[]; initialTab?: string } = {}): ReturnType<typeof render> {
  return render(
    <SportsTodayProvider today="2026-10-25">
      <MlbView data={data} {...props} />
    </SportsTodayProvider>
  );
}

const postseason = (): HTMLElement => screen.getByRole("tab", { name: "Postseason" });
const openTab = (): string | null => screen.getByRole("tab", { selected: true }).textContent;
const shownDays = (container: HTMLElement): Array<string | null> =>
  [...container.querySelectorAll("[data-day]")].map((el) => el.getAttribute("data-day"));

describe("MlbView", () => {
  it("is headed by the sport and the league, under the registry's ball", () => {
    renderOn(REGULAR_SEASON);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Baseball · MLB");
    expect(screen.getAllByText("⚾").length).toBeGreaterThan(0);
    expect(screen.getByText("Season 2026")).toBeInTheDocument();
  });

  it("opens on Overview with the Postseason locked while there is no bracket", () => {
    renderOn(REGULAR_SEASON);
    expect(openTab()).toBe("Overview");
    expect(postseason()).toBeDisabled();
    expect(postseason().querySelector("svg")).not.toBeNull();
  });

  it("opens on the bracket while the postseason has a series", () => {
    renderOn(MLB_DATA);
    expect(openTab()).toBe("Postseason");
    expect(postseason()).toBeEnabled();
    expect(postseason().querySelector("svg")).toBeNull();
    expect(screen.getAllByText("World Series").length).toBeGreaterThan(0);
  });

  it("draws the AL's rounds on one side of the World Series and the NL's on the other", () => {
    // The World Series opened at Milwaukee: by its home side, the NL took the AL's side.
    const { container } = renderOn(MLB_DATA);
    const leagueOf = new Map(MLB_DATA.standings.map((s) => [MLB_DATA.teams.find((t) => t.id === s.teamId)!.code, s.league]));
    const columns = [...container.querySelectorAll<HTMLElement>('[data-layout="whole"] [data-column]')];
    const leagues = columns.map((column) => [
      column.firstElementChild?.textContent,
      [...new Set([...leagueOf].filter(([code]) => column.textContent?.includes(code)).map(([, league]) => league))],
    ]);
    expect(leagues).toEqual([
      ["Wild Card", ["al"]],
      ["Division Series", ["al"]],
      ["Championship Series", ["al"]],
      ["World Series", ["al", "nl"]],
      ["Championship Series", ["nl"]],
      ["Division Series", ["nl"]],
      ["Wild Card", ["nl"]],
    ]);
  });

  it("opens on the news for ?tab=news, and has no News tab without any", () => {
    const story: NewsStory = {
      id: "1",
      headline: "Brewers take a 2–0 lead",
      description: null,
      href: "https://www.espn.com/mlb/story/_/id/1",
      external: true,
      image: { url: "https://a.espncdn.com/photo/1.jpg" },
      at: "2026-10-25T04:00:00Z",
      kind: "story",
      about: [],
    };
    const { unmount } = renderOn(MLB_DATA);
    expect(screen.queryByRole("tab", { name: "News" })).toBeNull();
    unmount();

    renderOn(MLB_DATA, { news: [story], initialTab: "news" });
    expect(openTab()).toBe("News");
  });

  it("names the table by the league shown, groups it by division, and spells out every abbreviation", () => {
    renderOn(REGULAR_SEASON);
    const al = screen.getByRole("table", { name: "American League standings" });
    expect(within(al).getAllByRole("columnheader").map((th) => th.getAttribute("aria-label"))).toEqual([
      "Seed",
      null,
      "Wins",
      "Losses",
      "Winning percentage",
      "Games behind division leader",
    ]);
    for (const [name, letters] of [
      ["Seed", "#"],
      ["Wins", "W"],
      ["Losses", "L"],
      ["Winning percentage", "PCT"],
      ["Games behind division leader", "GB"],
    ]) {
      expect(within(al).getByRole("columnheader", { name })).toHaveTextContent(letters);
    }
    // Each division under its own heading, its leader first, at its league seed.
    const groups = (table: HTMLElement): string[][] =>
      within(table)
        .getAllByRole("rowgroup")
        .slice(1)
        .map((group) =>
          within(group)
            .getAllByRole("rowheader")
            .map((th) => th.querySelector(".truncate")?.textContent ?? th.textContent ?? "")
        );
    expect(groups(al)).toEqual([
      ["AL East", "Rays", "Yankees", "Red Sox"],
      ["AL Central", "Guardians", "White Sox"],
      ["AL West", "Astros"],
    ]);
    // Baseball's percentage, and a dash for a division leader.
    const rays = within(al).getAllByRole("row")[2];
    expect(within(rays).getByText("1")).toBeInTheDocument();
    expect(within(rays).getByText(".605")).toBeInTheDocument();
    expect(within(rays).getByText("—")).toBeInTheDocument();
    expect(within(al).getByText("4.5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "National League" }));
    const nl = screen.getByRole("table", { name: "National League standings" });
    expect(groups(nl).map((g) => g[0])).toEqual(["NL East", "NL Central", "NL West"]);
    expect(groups(nl)[1][1]).toBe("Brewers");
  });

  it("gives a full name where the table is wide, and the club's code where it is narrow", () => {
    renderOn(REGULAR_SEASON);
    const al = screen.getByRole("table", { name: "American League standings" });
    const name = within(al).getByText("Rays");
    expect(name).toHaveAttribute("title", "Tampa Bay Rays");
    expect(name).toHaveClass("hidden", "truncate", "@sm:block");
    expect(name.previousElementSibling).toHaveTextContent("TB");
    expect(name.previousElementSibling).toHaveClass("@sm:hidden");
  });

  it("puts the standings beside the games, with baseball's own status words in the cards", () => {
    // A game under way is the test's own: the hand-written season has none.
    const live: MlbData = {
      ...REGULAR_SEASON,
      games: REGULAR_SEASON.games.map((g) =>
        g.id === "mlb-ws-3"
          ? { ...g, status: "live", homeScore: 2, awayScore: 3, statusText: { short: "Top 7th", spoken: "Top of the 7th inning" } }
          : g
      ),
    };
    const { container } = renderOn(live);
    const standings = screen.getByText("Standings").closest("section")!;
    const games = container.querySelector("[data-day]")!.closest("section")!;
    expect(standings.parentElement).toBe(games.parentElement);
    expect(within(standings).getByRole("group", { name: "League" })).toBeInTheDocument();

    expect(shownDays(container)).toEqual(["2026-10-25", "2026-10-27", "2026-10-28", "2026-10-29"]);
    expect(screen.getByText("F/10")).toBeInTheDocument();
    expect(screen.getByText("Top 7th")).toBeInTheDocument();
    expect(screen.getByText("World Series · Game 5, if necessary")).toBeInTheDocument();
  });

  it("narrows the games to a team tapped in the table, and back on a second tap", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = renderOn(REGULAR_SEASON);
    const table = screen.getByRole("table", { name: "American League standings" });
    const guardians = within(table).getByRole("button", { name: /Guardians/ });

    fireEvent.click(guardians);
    // Its last three results, the rainout's day before them behind the clock.
    expect(shownDays(container)).toEqual(["2026-10-18", "2026-10-20"]);
    expect(screen.getByRole("button", { name: "Filter by team: Guardians" })).toBeInTheDocument();
    expect(guardians).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(guardians);
    expect(shownDays(container)).toEqual(["2026-10-25", "2026-10-27", "2026-10-28", "2026-10-29"]);
  });

  it("leaves a club with no game in the list as plain text, not a toggle that would filter nothing", () => {
    renderOn(REGULAR_SEASON);
    const playing = new Set(REGULAR_SEASON.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]));
    const idle = REGULAR_SEASON.standings.find((s) => s.league === "al" && !playing.has(s.teamId));
    const active = REGULAR_SEASON.standings.find((s) => s.league === "al" && playing.has(s.teamId));
    expect(idle).toBeDefined();
    expect(active).toBeDefined();
    const nameOf = (teamId: string): string => REGULAR_SEASON.teams.find((t) => t.id === teamId)!.shortName;
    const table = screen.getByRole("table", { name: "American League standings" });
    const header = (teamId: string): HTMLElement =>
      within(table)
        .getAllByRole("rowheader")
        .find((th) => th.querySelector(".truncate")?.textContent === nameOf(teamId))!;

    expect(within(header(idle!.teamId)).queryByRole("button")).toBeNull();
    expect(within(header(active!.teamId)).getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });
});
