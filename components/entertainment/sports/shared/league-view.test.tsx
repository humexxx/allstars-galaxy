// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/sports", () => ({ setSportTeamFilterAction: vi.fn() }));
vi.mock("./confetti", () => ({ burstConfetti: vi.fn() }));

import { MLB_DATA } from "@/lib/data/sports/mlb";
import type { BracketRound, Match, Team } from "@/types/sports";

import { LeagueView } from "./league-view";
import { SportsTodayProvider } from "./time-zone-context";

const TEAMS = new Map<string, Team>(MLB_DATA.teams.map((t) => [t.id, t]));
const UNDECIDED = MLB_DATA.playoffs ?? [];
const DECIDED: BracketRound[] = UNDECIDED.map((round) =>
  round.id === "final"
    ? { ...round, matches: round.matches.map((m) => ({ ...m, homeScore: 1, awayScore: 4, winnerTeamId: "mil" })) }
    : round
);

function renderView(props: {
  games?: Match[];
  playoffs?: BracketRound[];
  table?: React.ReactNode;
  initialTab?: string;
}): void {
  render(
    <SportsTodayProvider today="2026-11-15">
      <LeagueView
        sportId="mlb"
        title="Baseball · MLB"
        subtitle="Season 2026"
        games={props.games ?? MLB_DATA.games}
        teams={TEAMS}
        standings={[]}
        playoffs={props.playoffs ?? []}
        bracketLabel="Postseason"
        news={[]}
        initialTab={props.initialTab}
        emptyTitle="No games scheduled"
        table={props.table}
      />
    </SportsTodayProvider>
  );
}

describe("LeagueView", () => {
  it("has no bracket tab until somebody is drawn into it, and a link to it lands on the Overview", () => {
    renderView({
      initialTab: "bracket",
      playoffs: [{ id: "final", label: "World Series", matches: [{ id: "ws", homeTeamId: null, awayTeamId: null }] }],
    });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview"]);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Overview");
    expect(screen.getByRole("tabpanel")).not.toBeEmptyDOMElement();
  });

  it("names the champion above a decided bracket, under the final's own name", () => {
    renderView({ playoffs: DECIDED });
    expect(screen.getByText("World Series champions")).toBeInTheDocument();
    expect(screen.getByText("Milwaukee Brewers")).toBeInTheDocument();
    expect(screen.getByText(/^Beat Rays 4–1 in the final/)).toBeInTheDocument();
  });

  it("names nobody while the final is still being played", () => {
    renderView({ playoffs: UNDECIDED });
    expect(screen.queryByText(/champions$/)).not.toBeInTheDocument();
  });

  it("leaves the standings alone on the Overview when no game is scheduled", () => {
    renderView({ games: [], table: <div>the table</div> });
    expect(screen.getByText("the table")).toBeInTheDocument();
    expect(screen.queryByText("No games scheduled")).not.toBeInTheDocument();
  });

  it("says no game is scheduled when there is no table to show instead", () => {
    renderView({ games: [] });
    expect(screen.getByText("No games scheduled")).toBeInTheDocument();
  });
});
