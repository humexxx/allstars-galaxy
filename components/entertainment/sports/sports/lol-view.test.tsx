// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { BracketMatch, LolData, LolSplit, Team } from "@/types/sports";

import { LolView } from "./lol-view";

const team = (code: string, name: string): Team => ({
  id: code.toLowerCase(),
  name,
  shortName: name,
  code,
  logoUrl: `https://static.lolesports.com/teams/${code}.png`,
  primaryColor: "#222",
});

const TEAMS = [team("T1", "T1"), team("GEN", "Gen.G"), team("KT", "kt Rolster"), team("HLE", "Hanwha Life Esports")];

// 02:00 UTC on the 15th: the evening of the 14th in Costa Rica.
const FINAL: BracketMatch = {
  id: "final",
  homeTeamId: "gen",
  awayTeamId: "t1",
  homeScore: 2,
  awayScore: 3,
  winnerTeamId: "t1",
  date: "2026-11-15T02:00:00Z",
  bestOf: 5,
};

const worlds: LolSplit = {
  region: "worlds",
  name: "Worlds 2026",
  season: "2026",
  international: true,
  teams: TEAMS,
  standings: [],
  matches: [
    {
      id: "final",
      homeTeamId: "gen",
      awayTeamId: "t1",
      homeScore: 2,
      awayScore: 3,
      bestOf: 5,
      date: FINAL.date!,
      status: "ft",
      stageLabel: "Finals",
    },
  ],
  playoffs: [
    {
      id: "semi-final",
      label: "Semifinals",
      matches: [
        { id: "sf1", homeTeamId: "kt", awayTeamId: "t1", homeScore: 1, awayScore: 3, winnerTeamId: "t1" },
        { id: "sf2", homeTeamId: "hle", awayTeamId: "gen", homeScore: 2, awayScore: 3, winnerTeamId: "gen" },
      ],
    },
    { id: "final", label: "Finals", matches: [FINAL] },
  ],
  champion: { teamId: "t1", final: FINAL },
};

const lck: LolSplit = {
  region: "lck",
  name: "LCK Split 3",
  season: "2026",
  teams: TEAMS,
  standings: [
    { position: 1, teamId: "gen", wins: 16, losses: 2 },
    { position: 2, teamId: "hle", wins: 14, losses: 4 },
  ],
  matches: [],
};

function renderView(data: LolData): void {
  render(
    <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
      <LolView data={data} />
    </ReaderTimeZoneProvider>
  );
}

const openTab = () => screen.getByRole("tab", { selected: true }).textContent;

describe("LolView after a final", () => {
  it("crowns the champion above the finished bracket", () => {
    renderView({ splits: [worlds, lck] });

    expect(openTab()).toBe("Playoffs");
    expect(screen.getByText("Worlds 2026 champions")).toBeInTheDocument();
    expect(screen.getByText("T1", { selector: "p" })).toBeInTheDocument();
    // The final's day in the reader's zone, not UTC's.
    expect(screen.getByText("Beat Gen.G 3–2 in the final · Nov 14")).toBeInTheDocument();
  });

  it("lists when each league is back once Lolesports has dated it", () => {
    renderView({
      splits: [worlds, lck],
      upcoming: [
        { region: "lck", name: "LCK Split 1", startDate: "2027-01-13" },
        { region: "lec", name: "LEC Split 1", startDate: "2027-01-16" },
      ],
    });

    const nextUp = screen.getByText("Next up").parentElement!;
    const rows = within(nextUp).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      "LCK Split 1Jan 13, 2027",
      "LEC Split 1Jan 16, 2027",
    ]);
  });

  it("says nothing about next season before it is listed", () => {
    renderView({ splits: [worlds], upcoming: [] });

    expect(screen.getByText("Worlds 2026 champions")).toBeInTheDocument();
    expect(screen.queryByText("Next up")).not.toBeInTheDocument();
  });

  it("has no banner for a split nobody has won yet", () => {
    renderView({
      splits: [{ ...worlds, champion: undefined }],
      upcoming: [{ region: "lck", name: "LCK Split 1", startDate: "2027-01-13" }],
    });

    expect(screen.queryByText(/champions$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Next up")).not.toBeInTheDocument();
  });
});

describe("LolView without a match list", () => {
  it("opens on the standings, and says so on the matches tab", () => {
    renderView({ splits: [lck] });

    expect(openTab()).toBe("Standings");
    expect(screen.getByText("Gen.G")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Matches" }));
    expect(openTab()).toBe("Matches");
    expect(screen.getByText("No matches to show")).toBeInTheDocument();
  });
});
