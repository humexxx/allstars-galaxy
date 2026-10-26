// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { F1DashboardHighlight } from "@/types/sports";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { AUSTIN, SINGAPORE } from "./__fixtures__/f1";
import { F1NextRace } from "./f1-next-race";
import { matchTimeFormat } from "./shared/match-time";

const HREF = "/portal/entertainment/sports?sport=f1";

function renderNextRace(highlight: Partial<F1DashboardHighlight>): HTMLElement {
  render(
    <F1NextRace
      highlight={{ season: 2026, race: AUSTIN, ...highlight }}
      format={matchTimeFormat("America/Costa_Rica")}
      href={HREF}
    />
  );
  return screen.getByRole("link");
}

const lastYear = { season: 2025, code: "VER", name: "M. Verstappen", team: "Red Bull" };

describe("F1NextRace", () => {
  it("leads with the round, the race and its start, like football's kickoff", () => {
    const box = renderNextRace({
      race: { ...AUSTIN, lastYear },
      nextSession: AUSTIN.sessions![0],
      nextSessionIn: "in 4d",
    });

    expect(box).toHaveAttribute("href", HREF);
    expect(box).toHaveTextContent("Round 18");
    // 20:00Z is 2 PM in Costa Rica.
    expect(box).toHaveTextContent("Oct 25 · 2:00 PM");
    expect(box).toHaveTextContent("United States Grand Prix");
    expect(box.querySelector('[data-slot="badge"]')).toHaveTextContent("Sprint");
    expect(box).toHaveTextContent("Circuit of the Americas · USA");
    expect(screen.getByText("Practice 1 in 4d · Fri, Oct 23, 11:30 AM")).toBeInTheDocument();
    expect(screen.getByText("2025 winner · M. Verstappen (Red Bull)")).toBeInTheDocument();
    expect(box.querySelector("svg")).not.toBeNull();
  });

  it("keeps the race's start on top while another session is live", () => {
    const [, sprintQualifying, sprint] = AUSTIN.sessions!;
    const box = renderNextRace({
      liveSession: sprintQualifying,
      nextSession: sprint,
      nextSessionIn: "in 20h",
    });
    expect(screen.getByText("Sprint Qualifying live")).toBeInTheDocument();
    expect(box).toHaveTextContent("Oct 25 · 2:00 PM");
    expect(box).toHaveTextContent("Sprint in 20h · Sat, Oct 24, 11:00 AM");
  });

  it("is simply live while the race runs", () => {
    const box = renderNextRace({ liveSession: AUSTIN.sessions!.at(-1) });
    expect(box.querySelector('[data-variant="success"]')).toHaveTextContent("Live");
    expect(box).not.toHaveTextContent("2:00 PM");
  });

  it("gives the result once the season's last race is run", () => {
    const box = renderNextRace({ race: SINGAPORE });
    // 12:00Z on the 11th is 6 AM that day in Costa Rica.
    expect(box).toHaveTextContent("Final · Oct 11");
    expect(screen.getByText("Winner VER")).toBeInTheDocument();
    expect(screen.getByText("Pole RUS")).toBeInTheDocument();
    expect(box).not.toHaveTextContent(/ in \d/);
  });

  it("falls back to the race's day when the feed has no start time", () => {
    const box = renderNextRace({ race: { ...AUSTIN, startsAt: undefined, sessions: undefined } });
    expect(box).toHaveTextContent("Oct 25");
    expect(box).not.toHaveTextContent("PM");
  });
});
