// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/lol", () => ({ getLolSplitAction: vi.fn() }));

import { getLolSplitAction } from "@/app/actions/lol";

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

describe("LolView, an international event's stages", () => {
  const playIns: LolSplit["playIns"] = [
    { id: "round-1", label: "Round 1", matches: [{ id: "p1", homeTeamId: "kt", awayTeamId: "hle", homeScore: 3, awayScore: 1, winnerTeamId: "kt", side: "upper" }] },
    { id: "round-2", label: "Final", matches: [{ id: "p2", homeTeamId: "kt", awayTeamId: "t1", homeScore: 3, awayScore: 0, winnerTeamId: "kt", side: "upper" }] },
  ];
  const tbd = { homeTeamId: null, awayTeamId: null };
  const undrawn: LolSplit["playoffs"] = [
    { id: "semi-final", label: "Semifinals", matches: [{ id: "s1", ...tbd }, { id: "s2", ...tbd }] },
    { id: "final", label: "Finals", matches: [{ id: "f", ...tbd }] },
  ];
  const swiss: LolSplit["swiss"] = { winsToAdvance: 3, lossesToExit: 3, rounds: [], exits: [] };
  const during: LolSplit = { ...worlds, champion: undefined, matches: [], playIns, swiss, playoffs: undrawn };
  const tabs = (): string[] => screen.getAllByRole("tab").map((t) => t.textContent ?? "");

  it("is a tab a stage, in the order played, on the Swiss stage while the playoffs are undrawn", () => {
    renderView({ splits: [during, lck] });
    expect(tabs()).toEqual(["Play-ins", "Swiss stage", "Playoffs"]);
    expect(openTab()).toBe("Swiss stage");
    expect(screen.getByRole("tab", { name: "Playoffs" })).toBeDisabled();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Play-ins" }), { button: 0 });
    expect(screen.getAllByText("Final").length).toBeGreaterThan(0);
  });

  it("opens on the playoffs once they are drawn", () => {
    renderView({ splits: [{ ...during, playoffs: worlds.playoffs }, lck] });
    expect(openTab()).toBe("Playoffs");
    expect(screen.getByRole("tab", { name: "Playoffs" })).not.toBeDisabled();
  });

  it("gives an event with no Swiss stage, as MSI, its play-ins and its playoffs", () => {
    const msi: LolSplit = { ...worlds, region: "msi", name: "MSI 2026", playIns, swiss: undefined };
    renderView({ splits: [msi, lck] });
    expect(tabs()).toEqual(["Play-ins", "Playoffs"]);
    expect(openTab()).toBe("Playoffs");
  });

  it("lays out an event whose only stage is an undrawn bracket as a league, on its matches", () => {
    const msi: LolSplit = { ...worlds, region: "msi", name: "MSI 2026", champion: undefined, standings: lck.standings, playoffs: undrawn };
    renderView({ splits: [msi, lck] });
    expect(tabs()).toEqual(["Matches", "Standings", "Playoffs"]);
    expect(openTab()).toBe("Matches");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Playoffs" }), { button: 0 });
    expect(screen.getByText("The bracket is not drawn yet")).toBeInTheDocument();
  });

  it("leaves a league its matches and its table", () => {
    renderView({ splits: [lck, during] });
    expect(tabs()).toEqual(["Matches", "Standings"]);
  });
});

describe("LolView, a league's other splits", () => {
  const seasonSplits = [
    { id: "115548106590082745", name: "LCK Split 1" },
    { id: "115548128960088078", name: "LCK Split 2" },
    { id: "115548147890329817", name: "LCK Split 3" },
  ];
  const latest: LolSplit = { ...lck, name: "LCK Split 3", tournamentId: "115548147890329817", seasonSplits };
  const first: LolSplit = { ...lck, name: "LCK Split 1", tournamentId: "115548106590082745", seasonSplits };

  it("moves between this season's splits from inside the league", async () => {
    vi.mocked(getLolSplitAction).mockResolvedValue({ success: true, data: first });
    renderView({ splits: [latest, worlds] });
    // The view is drawn anew for each split: the pills are looked up each time.
    const pill = (name: string): HTMLElement =>
      within(screen.getByRole("group", { name: "Splits of 2026" })).getByRole("radio", { name });
    expect(
      within(screen.getByRole("group", { name: "Splits of 2026" }))
        .getAllByRole("radio")
        .map((r) => r.textContent)
    ).toEqual(["Split 1", "Split 2", "Split 3"]);
    expect(pill("LCK Split 3")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(pill("LCK Split 1"));
    expect(getLolSplitAction).toHaveBeenCalledWith({ region: "lck", tournamentId: "115548106590082745" });
    // The split on screen names the page; the sport and its season go under it.
    const title = (): HTMLElement => screen.getByRole("heading", { level: 1 });
    await waitFor(() => expect(title()).toHaveTextContent(/^LCK Split 1$/));
    expect(screen.getByText("League of Legends · 2026")).toBeInTheDocument();

    // Back to the latest: the feed's own, nothing asked.
    fireEvent.click(pill("LCK Split 3"));
    expect(title()).toHaveTextContent(/^LCK Split 3$/);
    expect(getLolSplitAction).toHaveBeenCalledTimes(1);
  });

  it("says when the leagues are back only under the split the feed leads with", async () => {
    const won: LolSplit = { ...first, champion: { teamId: "t1", final: FINAL } };
    vi.mocked(getLolSplitAction).mockResolvedValue({ success: true, data: won });
    renderView({
      splits: [latest, worlds],
      upcoming: [{ region: "lck", name: "LCK Split 1", startDate: "2027-01-13" }],
    });

    fireEvent.click(
      within(screen.getByRole("group", { name: "Splits of 2026" })).getByRole("radio", { name: "LCK Split 1" })
    );
    await waitFor(() => expect(screen.getByText("LCK Split 1 champions")).toBeInTheDocument());
    expect(screen.queryByText("Next up")).not.toBeInTheDocument();
  });

  it("offers no pills to an international event", () => {
    renderView({ splits: [worlds, latest] });
    expect(screen.queryByRole("group", { name: /^Splits of/ })).toBeNull();
  });
});
