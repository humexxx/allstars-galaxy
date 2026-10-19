// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardSportCard as Card } from "@/types/sports";

const card: Card = {
  sportId: "nba",
  label: "NBA",
  emoji: "🏀",
  context: "Season 2026–27",
  matches: [],
  tables: [],
  note: {
    title: "2025–26 champions",
    text: "New York Knicks, 4–1 over San Antonio",
    // An evening tip-off in Costa Rica: the next day in UTC.
    when: { label: "Tips off", startsAt: "2026-10-21T01:30:00Z" },
  },
};

vi.mock("@/lib/services/sports-service", () => ({
  getDashboardSportCard: vi.fn(async () => card),
}));
vi.mock("@/lib/utils/request-today", () => ({
  getRequestTimeZone: vi.fn(async () => "America/Costa_Rica"),
}));
vi.mock("@/app/actions/sports", () => ({ setSportCompetitionAction: vi.fn() }));

import { DashboardSportCard } from "./dashboard-sport-card";

describe("DashboardSportCard's note", () => {
  it("stands in for the table, its date in the reader's zone", async () => {
    render(await DashboardSportCard({ sportId: "nba" }));

    expect(screen.getByText("2025–26 champions")).toBeInTheDocument();
    expect(screen.getByText("New York Knicks, 4–1 over San Antonio")).toBeInTheDocument();
    expect(screen.getByText("Tips off Tue, Oct 20")).toBeInTheDocument();
  });
});
