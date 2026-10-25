// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/sports", () => ({ setSportTeamFilterAction: vi.fn() }));

import { NHL_DATA } from "@/lib/data/sports/nhl";
import type { NewsStory, NhlData } from "@/types/sports";

import { SportsTodayProvider } from "../shared/time-zone-context";
import { NhlView } from "./nhl-view";

const REGULAR_SEASON: NhlData = { ...NHL_DATA, playoffs: [] };

/** The fixture's last spring with the Final still on: Carolina 3–2 up. */
const FINAL_ON: NhlData = {
  ...NHL_DATA,
  playoffs: NHL_DATA.playoffs.map((round) =>
    round.id === "final"
      ? { ...round, matches: round.matches.map((m) => ({ ...m, homeScore: 3, awayScore: 2, winnerTeamId: null })) }
      : round
  ),
};

/** Oct 25, the day of the fixture's live game; the reader's zone is UTC. */
function renderOn(data: NhlData, props: { news?: NewsStory[]; initialTab?: string } = {}): ReturnType<typeof render> {
  return render(
    <SportsTodayProvider today="2026-10-25">
      <NhlView data={data} {...props} />
    </SportsTodayProvider>
  );
}

const playoffs = (): HTMLElement => screen.getByRole("tab", { name: "Playoffs" });
const openTab = (): string | null => screen.getByRole("tab", { selected: true }).textContent;
const shownDays = (container: HTMLElement): Array<string | null> =>
  [...container.querySelectorAll("[data-day]")].map((el) => el.getAttribute("data-day"));

describe("NhlView", () => {
  it("is headed by the sport and the league, under the registry's stick, the season in both its years", () => {
    renderOn(REGULAR_SEASON);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ice Hockey · NHL");
    expect(screen.getAllByText("🏒").length).toBeGreaterThan(0);
    expect(screen.getByText("Season 2026–27")).toBeInTheDocument();
  });

  it("opens on Overview with the Playoffs locked while there is no bracket", () => {
    renderOn(REGULAR_SEASON);
    expect(openTab()).toBe("Overview");
    expect(playoffs()).toBeDisabled();
    expect(playoffs().querySelector("svg")).not.toBeNull();
  });

  it("keeps last spring's finished bracket behind its tab once there are games again", () => {
    renderOn(NHL_DATA);
    expect(openTab()).toBe("Overview");
    expect(playoffs()).toBeEnabled();
    expect(playoffs().querySelector("svg")).toBeNull();

    fireEvent.mouseDown(playoffs());
    expect(openTab()).toBe("Playoffs");
    expect(screen.getAllByText("Stanley Cup Final").length).toBeGreaterThan(0);
  });

  it("opens on the bracket while a series is on, and through a summer with no games", () => {
    const { unmount } = renderOn(FINAL_ON);
    expect(openTab()).toBe("Playoffs");
    unmount();

    renderOn({ ...NHL_DATA, games: [] });
    expect(openTab()).toBe("Playoffs");
  });

  it("opens on the news for ?tab=news, and has no News tab without any", () => {
    const story: NewsStory = {
      id: "1",
      headline: "Hurricanes stay top of the East",
      description: null,
      href: "https://www.espn.com/nhl/story/_/id/1",
      external: true,
      image: { url: "https://a.espncdn.com/photo/1.jpg" },
      at: "2026-10-25T04:00:00Z",
      kind: "story",
      about: [],
    };
    const { unmount } = renderOn(REGULAR_SEASON);
    expect(screen.queryByRole("tab", { name: "News" })).toBeNull();
    unmount();

    renderOn(REGULAR_SEASON, { news: [story], initialTab: "news" });
    expect(openTab()).toBe("News");
  });

  it("names the table by the conference shown, each row by its team, and spells out #, GP, W, L, OTL and PTS", () => {
    renderOn(REGULAR_SEASON);
    const east = screen.getByRole("table", { name: "Eastern Conference standings" });
    expect(within(east).getAllByRole("rowheader")[0]).toHaveTextContent("Hurricanes");
    expect(within(east).getAllByRole("columnheader").map((th) => th.getAttribute("aria-label"))).toEqual([
      "Seed",
      null,
      "Games played",
      "Wins",
      "Losses in regulation",
      "Overtime losses",
      "Points",
    ]);
    for (const [name, letters] of [
      ["Games played", "GP"],
      ["Wins", "W"],
      ["Losses in regulation", "L"],
      ["Overtime losses", "OTL"],
      ["Points", "PTS"],
    ]) {
      expect(within(east).getByRole("columnheader", { name })).toHaveTextContent(letters);
    }
    const carolina = within(east).getAllByRole("row")[1];
    expect(within(carolina).getAllByRole("cell").map((td) => td.textContent)).toEqual(["1", "13", "9", "2", "2", "20"]);

    fireEvent.click(screen.getByRole("radio", { name: "West" }));
    const west = screen.getByRole("table", { name: "Western Conference standings" });
    expect(within(west).getAllByRole("rowheader")[0]).toHaveTextContent("Oilers");
    expect(screen.queryByRole("table", { name: "Eastern Conference standings" })).toBeNull();
  });

  it("puts the standings beside the games, with hockey's own status words in the cards", () => {
    const { container } = renderOn(REGULAR_SEASON);
    const standings = screen.getByText("Standings").closest("section")!;
    const games = container.querySelector("[data-day]")!.closest("section")!;
    expect(standings.parentElement).toBe(games.parentElement);
    expect(within(standings).getByRole("group", { name: "Conference" })).toBeInTheDocument();

    expect(shownDays(container)).toEqual(["2026-10-25", "2026-10-28", "2026-10-30"]);
    expect(screen.getByText("P2 12:34")).toBeInTheDocument();
    expect(screen.getByText("OT")).toBeInTheDocument();
  });

  it("narrows the games to a team tapped in the table, and back on a second tap", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = renderOn(REGULAR_SEASON);
    const table = screen.getByRole("table", { name: "Eastern Conference standings" });
    const lightning = within(table).getByRole("button", { name: "Filter matches: Lightning" });

    fireEvent.click(lightning);
    // Its last three results, the Vegas win, Colorado and the overtime in Utah.
    expect(shownDays(container)).toEqual(["2026-10-21", "2026-10-24", "2026-10-25"]);
    expect(screen.getByRole("button", { name: "Filter by team: Lightning" })).toBeInTheDocument();
    expect(lightning).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(lightning);
    expect(shownDays(container)).toEqual(["2026-10-25", "2026-10-28", "2026-10-30"]);
  });
});
