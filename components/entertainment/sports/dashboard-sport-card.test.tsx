// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardMatch, DashboardSportCard as Card } from "@/types/sports";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/services/sports-service", () => ({ getDashboardSportCard: vi.fn() }));
vi.mock("@/lib/utils/request-today", () => ({
  getRequestTimeZone: vi.fn(async () => "America/Costa_Rica"),
}));
vi.mock("@/app/actions/sports", () => ({ setSportCompetitionAction: vi.fn() }));

import { getDashboardSportCard } from "@/lib/services/sports-service";

import { DashboardSportCard, groupCardMatches } from "./dashboard-sport-card";

const match = (id: string, status: DashboardMatch["status"], home: string, away: string): DashboardMatch => ({
  id,
  status,
  startsAt: "2026-10-24T02:00:00Z",
  label: "Swiss · BO1",
  home: { name: home, code: home, score: status === "upcoming" ? null : 1, winner: status === "result" },
  away: { name: away, code: away, score: status === "upcoming" ? null : 0, winner: false },
});

const card = (matches: DashboardMatch[]): Card => ({
  sportId: "lol",
  label: "League of Legends",
  emoji: "🎮",
  context: "Worlds 2026 · Swiss",
  featured: match("f", "upcoming", "T1", "FLY"),
  matches,
  tables: [],
});

describe("groupCardMatches", () => {
  it("labels each kind of match, live first, keeping the order within each", () => {
    const groups = groupCardMatches([
      match("1", "upcoming", "AL", "HLE"),
      match("2", "result", "TSW", "VKS"),
      match("3", "upcoming", "TES", "G2"),
      match("4", "live", "GEN", "PSG"),
    ]);
    expect(groups.map((g) => [g.label, g.matches.map((m) => m.id)])).toEqual([
      ["Live", ["4"]],
      ["Up next", ["1", "3"]],
      ["Latest results", ["2"]],
    ]);
  });

  it("leaves out a kind with nothing in it", () => {
    expect(groupCardMatches([match("1", "result", "KT", "TES")]).map((g) => g.label)).toEqual([
      "Latest results",
    ]);
    expect(groupCardMatches([])).toEqual([]);
  });
});

describe("DashboardSportCard", () => {
  async function renderCard(value: Card, competition: string | null = null): Promise<void> {
    vi.mocked(getDashboardSportCard).mockResolvedValue(value);
    render((await DashboardSportCard({ sportId: value.sportId, competition }))!);
  }

  it("lists the fixtures under Up next and the results under Latest results", async () => {
    await renderCard(
      card([
        match("1", "upcoming", "AL", "HLE"),
        match("2", "upcoming", "TES", "G2"),
        match("3", "result", "TSW", "VKS"),
      ])
    );

    const upNext = screen.getByText("Up next").parentElement!;
    const results = screen.getByText("Latest results").parentElement!;
    // Headings under the card's own h2, so a reader can jump between them.
    expect(screen.getByRole("heading", { level: 3, name: "Up next" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Latest results" })).toBeInTheDocument();
    // Preflight strips the bullets, and Safari the list with them, unless the role is spelled out.
    expect(within(upNext).getByRole("list")).toHaveAttribute("role", "list");
    expect(within(upNext).getAllByRole("listitem")).toHaveLength(2);
    expect(within(results).getByRole("listitem")).toHaveTextContent("TSW");
    // Up next comes first.
    expect(upNext.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does not title a list of results Up next", async () => {
    await renderCard(card([match("1", "result", "KT", "TES")]));

    expect(screen.queryByText("Up next")).not.toBeInTheDocument();
    expect(screen.getByText("Latest results")).toBeInTheDocument();
  });

  it("prints kickoffs in the reader's zone", async () => {
    await renderCard(card([match("1", "upcoming", "AL", "HLE")]));

    // 02:00 UTC on the 24th is 8:00 PM on the 23rd in Costa Rica.
    const upNext = screen.getByText("Up next").parentElement!;
    expect(within(upNext).getByText("8:00 PM")).toBeInTheDocument();
    expect(within(upNext).getByText("Oct 23")).toBeInTheDocument();
  });

  it("asks for the card on the championship it is set to", async () => {
    await renderCard(card([]), "lck");

    expect(getDashboardSportCard).toHaveBeenCalledWith("lol", "lck");
  });

  it("makes the line under the title the championship picker when the sport has a choice", async () => {
    await renderCard({
      ...card([]),
      competitions: {
        value: null,
        automatic: "Follow what's on",
        options: [{ id: "worlds", label: "Worlds 2026" }],
      },
    });

    expect(screen.getByRole("combobox", { name: "Championship" })).toHaveTextContent(
      "Worlds 2026 · Swiss"
    );
    expect(screen.getByRole("link", { name: /Open/ })).toHaveAttribute(
      "href",
      "/portal/entertainment/sports?sport=lol"
    );
  });

  it("names its Open link for the sport, so a page of cards has no seven links called Open", async () => {
    await renderCard(card([]));

    expect(screen.getByRole("link", { name: "Open League of Legends" })).toHaveAttribute(
      "href",
      "/portal/entertainment/sports?sport=lol"
    );
  });

  it("says who went through on penalties, which the level score does not", async () => {
    await renderCard({
      ...card([]),
      sportId: "football",
      featured: {
        id: "final",
        status: "result",
        startsAt: "2026-10-24T02:00:00Z",
        label: "Final",
        home: { name: "Arsenal", code: "ARS", score: 1, winner: true },
        away: { name: "Chelsea", code: "CHE", score: 1, winner: false },
      },
    });

    expect(screen.getByRole("link", { name: /Arsenal won on penalties/ })).toHaveAttribute(
      "href",
      "/portal/entertainment/sports?sport=football"
    );
  });

  it("says nothing of penalties for a result decided in play, or a draw", async () => {
    await renderCard({ ...card([]), featured: match("f", "result", "T1", "FLY") });
    expect(screen.getByText("Final · Oct 23")).toBeInTheDocument();
    expect(screen.queryByText(/won on penalties/)).toBeNull();
    cleanup();

    const draw = match("f", "result", "Arsenal", "Chelsea");
    await renderCard({
      ...card([]),
      featured: { ...draw, home: { ...draw.home, winner: false }, away: { ...draw.away, score: 1 } },
    });
    expect(screen.getByText("Final · Oct 23")).toBeInTheDocument();
    expect(screen.queryByText(/won on penalties/)).toBeNull();
  });

  it("keeps the plain line for a sport with nothing to choose", async () => {
    await renderCard({ ...card([]), sportId: "nfl", context: "Season 2026" });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Season 2026")).toBeInTheDocument();
  });

  it("opens football's hub on the league the card shows", async () => {
    await renderCard({
      ...card([]),
      sportId: "football",
      context: "LaLiga",
      competitions: { value: "la-liga", options: [{ id: "la-liga", label: "LaLiga" }] },
    });

    expect(screen.getByRole("link", { name: /Open/ })).toHaveAttribute(
      "href",
      "/portal/entertainment/sports?sport=football&league=la-liga"
    );
  });

  it("carries the latest news under the table, opened at ESPN in a new tab", async () => {
    await renderCard({
      ...card([]),
      sportId: "nba",
      label: "NBA",
      news: [
        {
          id: "espn-1",
          headline: "Giannis stays hot in a loss",
          description: null,
          href: "https://www.espn.com/nba/story/_/id/1",
          external: true,
          image: { url: "https://a.espncdn.com/photo/1.jpg" },
          at: "2026-10-24T04:36:05Z",
          kind: "story",
          about: [],
        },
      ],
    });
    const rail = screen.getByRole("region", { name: "NBA news" });
    const story = within(rail).getByRole("link", { name: /Giannis stays hot in a loss/ });
    expect(story).toHaveAttribute("href", "https://www.espn.com/nba/story/_/id/1");
    expect(story).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("heading", { level: 3, name: "Latest news" })).toBeInTheDocument();
  });

  it("opens each story's name on its headline, not on its photo's caption", async () => {
    await renderCard({
      ...card([]),
      sportId: "nba",
      label: "NBA",
      news: [
        {
          id: "espn-1",
          headline: "Giannis stays hot in a loss",
          description: null,
          href: "https://www.espn.com/nba/story/_/id/1",
          external: true,
          image: {
            url: "https://a.espncdn.com/photo/1.jpg",
            alt: "Giannis Antetokounmpo drives to the basket. (Photo by Stacy Revere/Getty Images)",
          },
          at: "2026-10-24T04:36:05Z",
          kind: "story",
          about: [],
        },
      ],
    });

    const story = screen.getByRole("link", { name: /Giannis stays hot in a loss/ });
    expect(story).toHaveAccessibleName(/^Giannis stays hot in a loss/);
    expect(story).not.toHaveAccessibleName(/Getty Images/);
  });

  it("steps through the games in the lead box, and moves the table up and the news to the last row", async () => {
    await renderCard({
      ...card([]),
      sportId: "nba",
      label: "NBA",
      following: [match("2", "upcoming", "NYK", "BOS"), match("3", "upcoming", "LAL", "GSW")],
      tables: [{ id: "east", label: "East", rows: [{ position: 1, name: "76ers", value: "3–0" }] }],
      news: [
        {
          id: "espn-1",
          headline: "Giannis stays hot in a loss",
          description: null,
          href: "https://www.espn.com/nba/story/_/id/1",
          external: true,
          image: null,
          at: "2026-10-24T04:36:05Z",
          kind: "story",
          about: [],
        },
      ],
    });

    // Named for its sport: three cards would otherwise be three "Games" landmarks.
    const carousel = screen.getByRole("region", { name: "NBA games" });
    expect(within(carousel).getAllByRole("group").map((slide) => slide.textContent)).toEqual([
      expect.stringContaining("T1"),
      expect.stringContaining("NYK"),
      expect.stringContaining("LAL"),
    ]);
    expect(within(carousel).getAllByRole("button", { name: /^Show game/ })).toHaveLength(3);
    // No list of the same games under it.
    expect(screen.queryByText("Up next")).toBeNull();
    // The card's rows: header, lead, then the table, then the news.
    const rows = [...screen.getByRole("heading", { name: /NBA/ }).closest("[data-slot=card]")!.children];
    expect(rows[2]).toHaveTextContent("76ers");
    expect(rows[3]).toHaveTextContent("Latest news");
  });

  it("leaves no empty row: a card with nothing to list puts its table right under the lead", async () => {
    await renderCard({
      ...card([]),
      sportId: "tennis",
      label: "Tennis",
      featured: undefined,
      event: { name: "Paris Masters", detail: "Paris", status: "upcoming" },
      tables: [{ id: "atp", label: "Rankings", rows: [{ position: 1, name: "J. Sinner", value: "11,500" }] }],
    });
    const rows = [...screen.getByRole("heading", { name: /Tennis/ }).closest("[data-slot=card]")!.children];
    expect(rows).toHaveLength(4);
    expect(rows[2]).toHaveTextContent("J. Sinner");
    expect(rows[3]).toBeEmptyDOMElement();
    // One table: its label is the row's heading, and its rows a list Safari still counts.
    expect(within(rows[2] as HTMLElement).getByRole("heading", { level: 3, name: "Rankings" })).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByRole("list")).toHaveAttribute("role", "list");
  });

  it("has no news rail for a sport without a wire", async () => {
    await renderCard(card([]));
    expect(screen.queryByText("Latest news")).toBeNull();
  });
});
