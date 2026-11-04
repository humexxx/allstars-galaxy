// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

function renderView(data: LolData, link: { initialTab?: string; initialRegion?: string } = {}): void {
  render(
    <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
      <LolView data={data} {...link} />
    </ReaderTimeZoneProvider>
  );
}

const openTab = () => screen.getByRole("tab", { selected: true }).textContent;
const title = (): HTMLElement => screen.getByRole("heading", { level: 1 });
const titleButton = (): HTMLElement => within(title()).getByRole("button");
const announced = (): string[] => screen.queryAllByRole("status").map((s) => s.textContent ?? "");

describe("LolView from a link", () => {
  it("opens on the league and the tab the address names", () => {
    renderView({ splits: [worlds, lck] }, { initialRegion: "lck", initialTab: "standings" });
    expect(title()).toHaveTextContent("LCK Split 3");
    expect(openTab()).toBe("Standings");
  });

  it("falls back to the event on, and its own tab, for what the feed has not got", () => {
    renderView({ splits: [worlds, lck] }, { initialRegion: "msi", initialTab: "swiss" });
    expect(title()).toHaveTextContent(worlds.name);
  });
});

describe("LolView's title menu", () => {
  it("names each group of the menu by its label", async () => {
    renderView({ splits: [worlds, lck] });
    fireEvent.keyDown(titleButton(), { key: "Enter" });

    const international = await screen.findByRole("group", { name: "International" });
    expect(within(international).getByRole("menuitemradio", { name: "Worlds 2026" })).toBeInTheDocument();
    const leagues = screen.getByRole("group", { name: "Leagues" });
    expect(within(leagues).getByRole("menuitemradio", { name: "LCK Split 3" })).toBeInTheDocument();
  });

  it("keeps the focus on the title once another league is picked, on that league's own tab", async () => {
    renderView({ splits: [worlds, lck] });
    expect(openTab()).toBe("Playoffs");
    titleButton().focus();
    fireEvent.keyDown(titleButton(), { key: "Enter" });
    fireEvent.keyDown(await screen.findByRole("menuitemradio", { name: "LCK Split 3" }), { key: "Enter" });

    await waitFor(() => expect(title()).toHaveTextContent(/^LCK Split 3$/));
    await waitFor(() => expect(titleButton()).toHaveFocus());
    // Worlds' playoffs are not the LCK's: it opens on its own table.
    expect(openTab()).toBe("Standings");
  });
});

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

describe("LolView, a league's matches and table", () => {
  const played: LolSplit = {
    ...lck,
    matches: [
      {
        id: "m1",
        homeTeamId: "t1",
        awayTeamId: "gen",
        homeScore: 2,
        awayScore: 1,
        bestOf: 3,
        date: "2026-08-20T09:00:00Z",
        status: "ft",
        stageLabel: "Week 1",
      },
      {
        id: "m2",
        homeTeamId: "kt",
        awayTeamId: "hle",
        homeScore: 1,
        awayScore: 0,
        bestOf: 3,
        date: "2026-08-21T09:00:00Z",
        status: "live",
        stageLabel: "Week 1",
      },
    ],
  };

  it("lists the matches, a status in words and the series length spelled out", () => {
    renderView({ splits: [played] });

    expect(openTab()).toBe("Matches");
    const list = within(screen.getByRole("tabpanel")).getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    // "FT" is football's full time; a series is final.
    expect(within(list).getByText("Final")).toBeInTheDocument();
    expect(within(list).queryByText("ft")).not.toBeInTheDocument();
    expect(within(list).getByText("Live")).toHaveClass("text-foreground");
    for (const bo of within(list).getAllByText("BO3")) expect(bo).toHaveAttribute("aria-hidden", "true");
    expect(within(list).getAllByText("best of 3")).toHaveLength(2);
  });

  it("names the table, heads each row with its team and spells out W and L", () => {
    renderView({ splits: [played] });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Standings" }), { button: 0 });

    const table = screen.getByRole("table", { name: "LCK Split 3 standings" });
    expect(within(table).getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
      "Gen.G",
      "Hanwha Life Esports",
    ]);
    expect(within(table).getByRole("columnheader", { name: "Wins" })).toHaveTextContent("W");
    expect(within(table).getByRole("columnheader", { name: "Losses" })).toHaveTextContent("L");
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
  const pill = (name: string): HTMLElement =>
    within(screen.getByRole("group", { name: "Splits of 2026" })).getByRole("radio", { name });

  beforeEach(() => {
    vi.mocked(getLolSplitAction).mockReset();
  });

  it("moves between this season's splits from inside the league", async () => {
    vi.mocked(getLolSplitAction).mockResolvedValue({ success: true, data: first });
    renderView({ splits: [latest, worlds] });
    expect(
      within(screen.getByRole("group", { name: "Splits of 2026" }))
        .getAllByRole("radio")
        .map((r) => r.textContent)
    ).toEqual(["Split 1", "Split 2", "Split 3"]);
    expect(pill("LCK Split 3")).toHaveAttribute("aria-checked", "true");

    pill("LCK Split 1").focus();
    fireEvent.click(pill("LCK Split 1"));
    expect(getLolSplitAction).toHaveBeenCalledWith({ region: "lck", tournamentId: "115548106590082745" });
    // The split on screen names the page; the sport and its season go under it.
    await waitFor(() => expect(title()).toHaveTextContent(/^LCK Split 1$/));
    expect(screen.getByText("League of Legends · 2026")).toBeInTheDocument();
    // The pills outlive the split they show, so the one pressed keeps the focus.
    expect(pill("LCK Split 1")).toHaveFocus();

    // Back to the latest: the feed's own, nothing asked.
    pill("LCK Split 3").focus();
    fireEvent.click(pill("LCK Split 3"));
    expect(title()).toHaveTextContent(/^LCK Split 3$/);
    expect(pill("LCK Split 3")).toHaveFocus();
    expect(getLolSplitAction).toHaveBeenCalledTimes(1);
  });

  it("says which split is being read", () => {
    vi.mocked(getLolSplitAction).mockReturnValue(new Promise(() => {}));
    renderView({ splits: [latest, worlds] });
    expect(announced()).not.toContain("Loading LCK Split 1…");

    fireEvent.click(pill("LCK Split 1"));
    expect(announced()).toContain("Loading LCK Split 1…");
  });

  it("says when a split could not be read, and keeps the focus on its pill to try again", async () => {
    vi.mocked(getLolSplitAction)
      .mockResolvedValueOnce({ success: false, error: "The split could not be loaded" })
      .mockReturnValueOnce(new Promise(() => {}));
    renderView({ splits: [latest, worlds] });

    fireEvent.click(pill("LCK Split 1"));
    await waitFor(() => expect(announced()).toContain("The split could not be loaded"));

    const retry = screen.getByRole("button", { name: "Try again" });
    retry.focus();
    fireEvent.click(retry);
    expect(getLolSplitAction).toHaveBeenCalledTimes(2);
    expect(announced()).toContain("Loading LCK Split 1…");
    expect(pill("LCK Split 1")).toHaveFocus();
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
