// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { F1_DATA } from "@/lib/data/sports/f1";
import { F1_CIRCUIT_OUTLINES, F1_CIRCUIT_VIEWBOX } from "@/lib/data/sports/f1-circuits";
import type { F1Data } from "@/types/sports";

import { F1View } from "./f1-view";

// The races' sheet loads a classification through a server action.
vi.mock("@/app/actions/f1", () => ({ getF1RaceClassificationAction: vi.fn() }));
// The shared split lives beside the match lists, whose team filter saves through one.
vi.mock("@/app/actions/sports", () => ({ setSportTeamFilterAction: vi.fn() }));

beforeEach(() => {
  // The race sheet picks its side from the viewport; jsdom has no matchMedia.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
});

const tabs = () => screen.getAllByRole("tab").map((t) => t.textContent);
const openTab = () => screen.getByRole("tab", { selected: true }).textContent;
const championship = (name: "Drivers" | "Constructors") => screen.getByRole("radio", { name });

describe("F1View", () => {
  it("opens on one Overview tab: the races beside the standings, as football's matches and table", () => {
    render(<F1View data={F1_DATA} />);
    expect(tabs()).toEqual(["Overview"]);
    expect(openTab()).toBe("Overview");
    expect(championship("Drivers")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("columnheader", { name: "Driver" })).toBeInTheDocument();

    const standings = screen.getByText("Standings").closest("section")!;
    const races = screen.getByRole("heading", { name: "Next race" }).closest("section")!.parentElement!;
    expect(standings.parentElement).toBe(races.parentElement);
    expect(standings.parentElement).toHaveClass("@4xl:grid-cols-[2fr_1fr]");
  });

  it("puts the next race's card level with the standings card: both open on a day heading's line", () => {
    render(<F1View data={F1_DATA} />);
    const heading = screen.getByRole("heading", { name: "Next race" });
    const label = screen.getByText("Standings");
    for (const cls of ["text-2xs", "py-1"]) {
      expect(heading).toHaveClass(cls);
      expect(label).toHaveClass(cls);
    }
    expect(heading.parentElement).toHaveClass("gap-2");
    expect(label.parentElement).toHaveClass("gap-2");
    // The heading says "Next race"; the card under it no longer repeats it.
    const card = heading.nextElementSibling!;
    expect(card).toHaveTextContent(/^Round \d+/);
    expect(card).not.toHaveTextContent("Next race");
  });

  it("drops Wins, then Podiums, as the standings card narrows, by its own width", () => {
    render(<F1View data={F1_DATA} />);
    const card = screen.getByRole("table").closest('[data-slot="card"]');
    expect(card).toHaveClass("@container");
    expect(screen.getByRole("columnheader", { name: "Wins" })).toHaveClass("hidden", "@xs:table-cell");
    expect(screen.getByRole("columnheader", { name: "Podiums" })).toHaveClass("hidden", "@sm:table-cell");
    expect(screen.getByRole("columnheader", { name: "Points" })).not.toHaveClass("hidden");
  });

  it("swaps the table between the championships, columns and badges included", () => {
    render(<F1View data={F1_DATA} />);
    fireEvent.click(championship("Constructors"));

    expect(championship("Constructors")).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("columnheader", { name: "Driver" })).toBeNull();
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "#",
      "Team",
      "Points",
      "Wins",
      "Podiums",
    ]);
    // No logo in the fixture, so the livery disc stands in.
    expect(screen.getByText("MER")).toBeInTheDocument();

    fireEvent.click(championship("Drivers"));
    expect(screen.getByText("A.K. Antonelli")).toBeInTheDocument();
  });

  it.each([
    ["drivers", "Drivers", "Driver"],
    ["constructors", "Constructors", "Team"],
  ] as const)("opens an old ?tab=%s link on Overview, on that table", (tab, mode, column) => {
    render(<F1View data={F1_DATA} initialTab={tab} />);
    expect(openTab()).toBe("Overview");
    expect(championship(mode)).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
  });

  it.each(["standings", "races"])("opens an old ?tab=%s link on Overview", (tab) => {
    render(<F1View data={F1_DATA} initialTab={tab} />);
    expect(openTab()).toBe("Overview");
    expect(championship("Drivers")).toHaveAttribute("aria-checked", "true");
  });

  it("falls back to Overview for ?tab=news when there is no news", () => {
    render(<F1View data={F1_DATA} initialTab="news" />);
    expect(openTab()).toBe("Overview");
  });

  it("draws each race's circuit, and leaves a race with no outline as it was", () => {
    const [monaco, spain] = F1_DATA.races.filter((r) => r.round === 8 || r.round === 9);
    const data: F1Data = { ...F1_DATA, races: [monaco, { ...spain, circuitId: "kyalami" }] };
    render(<F1View data={data} initialTab="races" />);

    const outline = (scope: Element | null) =>
      scope?.querySelector(`svg[viewBox="${F1_CIRCUIT_VIEWBOX}"]`);
    // Monaco is next, so it is the featured card; Spain is a tile under Coming up.
    const featured = screen.getByRole("button", { name: "Monaco GP" }).closest('[data-slot="card"]');
    expect(outline(featured)?.querySelector("path")).toHaveAttribute(
      "d",
      F1_CIRCUIT_OUTLINES.monaco
    );
    const tile = screen.getByRole("button", { name: /Spanish GP/ });
    expect(outline(tile)).toBeNull();
    // The circuit is still named in words.
    expect(tile).toHaveTextContent("Circuit de Barcelona");
  });
});
