// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/sports", () => ({ setSportTeamFilterAction: vi.fn() }));

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import { NBA_DATA } from "@/lib/data/sports/nba";
import type { NbaData } from "@/types/sports";

import { NbaView } from "./nba-view";

const postseason = () => screen.getByRole("tab", { name: "Postseason" });
const openTab = () => screen.getByRole("tab", { selected: true }).textContent;

describe("NbaView", () => {
  it("shows the Postseason tab locked while there is no bracket", () => {
    render(<NbaView data={{ ...NBA_DATA, playoffs: [] }} />);
    expect(openTab()).toBe("Overview");
    expect(postseason()).toBeDisabled();
    expect(postseason().querySelector("svg")).not.toBeNull();
  });

  it("opens on the bracket once the postseason has one", () => {
    const [home, away] = NBA_DATA.teams;
    const data: NbaData = {
      ...NBA_DATA,
      playoffs: [
        {
          id: "final",
          label: "NBA Finals",
          matches: [
            {
              id: "nba-final",
              homeTeamId: home.id,
              awayTeamId: away.id,
              homeScore: 4,
              awayScore: 1,
              winnerTeamId: home.id,
              bestOf: 7,
            },
          ],
        },
      ],
    };
    render(<NbaView data={data} />);
    expect(openTab()).toBe("Postseason");
    expect(postseason()).toBeEnabled();
    expect(postseason().querySelector("svg")).toBeNull();
    expect(screen.getByText("NBA Finals")).toBeInTheDocument();
  });

  describe("before the opener", () => {
    const preseason: NbaData = {
      ...NBA_DATA,
      season: "2026–27",
      standings: [],
      playoffs: [],
      champion: { season: "2025–26", teamId: "nyk", summary: "New York Knicks, 4–1 over San Antonio" },
      // An evening tip-off in Costa Rica: the next day in UTC.
      tipOff: "2026-10-21T01:30:00Z",
    };
    const renderIn = (data: NbaData) =>
      render(
        <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
          <NbaView data={data} />
        </ReaderTimeZoneProvider>
      );

    it("names last season's champion, and when this season and its table start", () => {
      renderIn(preseason);
      expect(screen.getByText("2025–26 champions: New York Knicks, 4–1 over San Antonio")).toBeInTheDocument();
      expect(screen.getByText("Tips off Tue, Oct 20 · Standings start with the opener")).toBeInTheDocument();
      expect(screen.queryByText("Standings")).toBeNull();
    });

    it("leaves the table's note out when there is a table", () => {
      renderIn({ ...preseason, standings: NBA_DATA.standings });
      expect(screen.getByText("Tips off Tue, Oct 20")).toBeInTheDocument();
      expect(screen.getByText("Standings")).toBeInTheDocument();
    });

    it("says nothing about it once the season is under way", () => {
      renderIn({ ...preseason, champion: undefined, tipOff: undefined });
      expect(screen.queryByText(/champions/)).toBeNull();
      expect(screen.queryByText(/Tips off/)).toBeNull();
    });
  });
});
