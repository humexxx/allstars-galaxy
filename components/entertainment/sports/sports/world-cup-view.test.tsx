// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../shared/confetti", () => ({ burstConfetti: vi.fn() }));

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { BracketMatch, FootballLeagueData, NewsStory, Standing, Team } from "@/types/sports";

import { WorldCupView } from "./world-cup-view";

const team = (code: string, name: string): Team => ({
  id: code.toLowerCase(),
  name,
  shortName: name,
  code,
});

const row = (position: number, teamId: string, points: number): Standing => ({
  position,
  teamId,
  played: 3,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  points,
});

const FINAL: BracketMatch = {
  id: "m-1",
  homeTeamId: "arg",
  awayTeamId: "fra",
  homeScore: 1,
  awayScore: 1,
  penalties: { home: 2, away: 4 },
  winnerTeamId: "fra",
  date: "2026-07-19T19:00:00Z",
};

const DATA: FootballLeagueData = {
  league: {
    id: "world-cup",
    name: "FIFA World Cup 2026",
    shortName: "World Cup",
    region: "FIFA",
    hasKnockout: true,
    season: "2026",
  },
  teams: [team("ARG", "Argentina"), team("FRA", "France")],
  matches: [],
  standings: [],
  groups: [{ label: "Group A", standings: [row(1, "arg", 9), row(2, "fra", 6)] }],
  knockout: [{ id: "final", label: "Final", matches: [FINAL] }],
};

const NEWS: NewsStory[] = [
  {
    id: "n1",
    headline: "France lift the trophy",
    description: null,
    href: "https://example.com/n1",
    external: true,
    image: null,
    at: "2026-07-20T08:00:00Z",
    kind: "story",
    about: [],
  },
];

function renderView(props: Partial<React.ComponentProps<typeof WorldCupView>> = {}): void {
  render(
    <ReaderTimeZoneProvider timeZone="UTC">
      <WorldCupView data={DATA} {...props} />
    </ReaderTimeZoneProvider>
  );
}

const tabs = (): (string | null)[] => screen.getAllByRole("tab").map((t) => t.textContent);
const openTab = (): string | null => screen.getByRole("tab", { selected: true }).textContent;

describe("WorldCupView", () => {
  it("has the groups and the knockout, News only with news, and opens on the knockout", () => {
    renderView({ news: NEWS });
    expect(tabs()).toEqual(["Groups", "Knockout", "News"]);
    expect(openTab()).toBe("Knockout");

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Groups" }), { button: 0 });
    expect(openTab()).toBe("Groups");
    expect(screen.getByText("Group A")).toBeInTheDocument();
  });

  it("opens on the groups before the knockout is drawn, with no News tab without news", () => {
    renderView({ data: { ...DATA, knockout: [] } });
    expect(tabs()).toEqual(["Groups", "Knockout"]);
    expect(openTab()).toBe("Groups");
    expect(screen.getByRole("tab", { name: "Knockout" })).toBeDisabled();
  });

  it("heads each group at level 2 and names its table after it", () => {
    renderView({ data: { ...DATA, knockout: [] } });
    expect(screen.getByRole("heading", { level: 2, name: "Group A" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Group A" })).toBeInTheDocument();
  });

  it("keys a group's zones by where they lead in the World Cup", () => {
    const group = [row(1, "arg", 9), row(2, "fra", 6)].map((r, i) => ({
      ...r,
      band: i === 0 ? ("champions" as const) : ("playoff" as const),
    }));
    renderView({ data: { ...DATA, knockout: [], groups: [{ label: "Group A", standings: group }] } });
    const key = screen.getByRole("list", { name: "Key" });
    expect(within(key).getAllByRole("listitem").map((i) => i.textContent)).toEqual([
      "Round of 32",
      "Best third places",
    ]);
  });

  it("opens on the news when the address asks for it", () => {
    renderView({ news: NEWS, openNews: true });
    expect(openTab()).toBe("News");
    expect(screen.getByText("France lift the trophy")).toBeInTheDocument();
  });

  it("crowns the winner of the final, shoot-out and all, from the champion's side", () => {
    renderView();
    expect(screen.getByText("FIFA World Cup 2026 champions")).toBeInTheDocument();
    expect(
      screen.getByText("Beat Argentina 1–1, 4–2 on penalties, in the final · Jul 19")
    ).toBeInTheDocument();
  });

  it("has no champion while the final has no winner", () => {
    const undecided = { ...FINAL, penalties: undefined, winnerTeamId: null };
    renderView({ data: { ...DATA, knockout: [{ id: "final", label: "Final", matches: [undecided] }] } });
    expect(screen.queryByText(/champions$/)).not.toBeInTheDocument();
  });
});
