// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardMatch, DashboardSportCard as Card } from "@/types/sports";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/services/sports-service", () => ({ getDashboardSportCard: vi.fn() }));
vi.mock("@/lib/utils/request-today", () => ({
  getRequestTimeZone: vi.fn(async () => "America/Costa_Rica"),
}));

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
  async function renderCard(value: Card): Promise<void> {
    vi.mocked(getDashboardSportCard).mockResolvedValue(value);
    render(await DashboardSportCard({ sportId: value.sportId }));
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
});
