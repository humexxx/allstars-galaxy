// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SURF_DATA } from "@/lib/data/sports/surf";
import type { SurfData, SurfEvent } from "@/types/sports";

import { SurfView } from "./surf-view";

const openTab = (): string | null => screen.getByRole("tab", { selected: true }).textContent;
const goTo = (name: string): void => {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
};

/** The sample season with its stop on now finished: no draw under way, Portugal-style. */
function seasonOver(): SurfData {
  const events = SURF_DATA.events.map((e): SurfEvent =>
    e.id === "sample-tahiti" ? { ...e, status: "completed", winner: "Kauli Vaast", runnerUp: "Gabriel Medina" } : e
  );
  return { ...SURF_DATA, events, draw: undefined };
}

describe("SurfView", () => {
  it("is headed by the sport, the tour and its season", () => {
    render(<SurfView data={SURF_DATA} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Surfing");
    expect(screen.getByText("Championship Tour · Season 2026")).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Draw"]);
  });

  it("opens on the draw while a stop is on, and on the Overview when asked", () => {
    render(<SurfView data={SURF_DATA} />);
    expect(openTab()).toBe("Draw");

    goTo("Overview");
    expect(openTab()).toBe("Overview");
  });

  it("opens on the Overview when asked, or when no stop is on", () => {
    const { unmount } = render(<SurfView data={SURF_DATA} initialTab="overview" />);
    expect(openTab()).toBe("Overview");
    unmount();

    const upcoming = SURF_DATA.events.map((e): SurfEvent => (e.status === "live" ? { ...e, status: "upcoming" } : e));
    render(<SurfView data={{ ...SURF_DATA, events: upcoming }} />);
    expect(openTab()).toBe("Overview");
  });

  it("features the stop on now, with the heat in the water and a way to its draw", () => {
    render(<SurfView data={SURF_DATA} initialTab="overview" />);
    const onNow = screen.getByRole("heading", { level: 2, name: "On now" }).closest("section")!;
    expect(within(onNow).getByRole("heading", { level: 3, name: "Tahiti Pro" })).toBeInTheDocument();
    expect(onNow).toHaveTextContent("Event 4");
    expect(onNow).toHaveTextContent("Live");
    expect(onNow).toHaveTextContent("Teahupoʻo, Tahiti, French Polynesia");
    expect(onNow).toHaveTextContent("Round 2, heat 2 in the water");

    fireEvent.click(within(onNow).getByRole("button", { name: "View draw" }));
    expect(openTab()).toBe("Draw");
  });

  it("names the winner and runner-up of every stop surfed, on its tile", () => {
    render(<SurfView data={SURF_DATA} initialTab="overview" />);
    const earlier = screen.getByRole("heading", { level: 2, name: "Earlier events" }).closest("section")!;
    const tiles = within(earlier)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    // Latest first.
    expect(tiles).toEqual(["Gold Coast Pro", "Margaret River Pro", "Rip Curl Pro Bells Beach"]);
    const goldCoast = within(earlier).getByRole("heading", { name: "Gold Coast Pro" }).closest("[data-tournament]")!;
    expect(goldCoast).toHaveTextContent("Winner: Italo Ferreira d.defeated Griffin Colapinto");

    const comingUp = screen.getByRole("heading", { level: 2, name: "Coming up" }).closest("section")!;
    expect(
      within(comingUp)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent)
    ).toEqual(["Trestles Pro", "Pipe Masters"]);
  });

  it("still lists a stop left on while another is featured", () => {
    const events = SURF_DATA.events.map((e): SurfEvent =>
      e.id === "sample-gold-coast" ? { ...e, status: "live", winner: undefined } : e
    );
    render(<SurfView data={{ ...SURF_DATA, events }} initialTab="overview" />);
    const alsoOn = screen.getByRole("heading", { level: 2, name: "Also on" }).closest("section")!;
    const tile = within(alsoOn)
      .getByRole("heading", { level: 3, name: "Gold Coast Pro" })
      .closest("[data-tournament]")!;
    expect(tile).toHaveTextContent("Live");
    const onNow = screen.getByRole("heading", { level: 2, name: "On now" }).closest("section")!;
    expect(within(onNow).getByRole("heading", { level: 3 })).toHaveTextContent("Tahiti Pro");
  });

  it("puts the winner on the featured card once its stop is over, and locks the draw without one", () => {
    render(<SurfView data={seasonOver()} />);
    expect(openTab()).toBe("Overview");
    expect(screen.getByRole("tab", { name: "Draw" })).toBeDisabled();

    const featured = screen.getByRole("heading", { level: 2, name: "Next up" }).closest("section")!;
    expect(within(featured).getByRole("heading", { level: 3 })).toHaveTextContent("Trestles Pro");
    const earlier = screen.getByRole("heading", { level: 2, name: "Earlier events" }).closest("section")!;
    expect(within(earlier).getByRole("heading", { name: "Tahiti Pro" }).closest("[data-tournament]")).toHaveTextContent(
      "Winner: Kauli Vaast"
    );
  });

  it("calls the last stop surfed the last event once the season is over", () => {
    const events = SURF_DATA.events.map((e): SurfEvent => ({
      ...e,
      status: "completed",
      winner: e.winner ?? "Yago Dora",
    }));
    render(<SurfView data={{ ...SURF_DATA, events, draw: undefined }} />);
    const last = screen.getByRole("heading", { level: 2, name: "Last event" }).closest("section")!;
    expect(within(last).getByRole("heading", { level: 3 })).toHaveTextContent("Pipe Masters");
    expect(last).toHaveTextContent("Yago Dora");
    expect(screen.queryByRole("button", { name: "View draw" })).toBeNull();
  });

  it("lists the rankings in a named table, each row headed by its surfer, ten then the rest", () => {
    render(<SurfView data={SURF_DATA} initialTab="overview" />);
    const table = screen.getByRole("table", { name: "Rankings" });
    expect(within(table).getByRole("columnheader", { name: "Rank" })).toHaveTextContent("#");
    expect(within(table).getByRole("columnheader", { name: "Surfer" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Points" })).toHaveTextContent("Pts");

    const surfers = within(table).getAllByRole("rowheader");
    expect(surfers).toHaveLength(10);
    expect(surfers[0]).toHaveTextContent("Italo Ferreira, Brazil");
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("25,190");

    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
    expect(within(table).getAllByRole("rowheader")).toHaveLength(12);
  });

  it("leaves the rankings out when none are published", () => {
    render(<SurfView data={{ ...SURF_DATA, rankings: [] }} initialTab="overview" />);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("draws the heats round by round, the winners bold and said, the seeds muted", () => {
    render(<SurfView data={SURF_DATA} />);
    const rounds = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(rounds).toEqual(["Round 1", "Round 2", "Quarterfinals"]);

    const round2 = screen.getByRole("heading", { level: 2, name: "Round 2" }).closest("section")!;
    const heats = within(round2)
      .getAllByRole("listitem")
      .filter((li) => li.parentElement?.tagName === "OL");
    expect(heats.map((h) => within(h).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Heat 1",
      "Heat 2",
      "Heat 3",
    ]);
    expect(heats.map((h) => ["Completed", "Live", "Upcoming"].find((s) => h.textContent?.includes(s)) ?? "")).toEqual([
      "Completed",
      "Live",
      "Upcoming",
    ]);

    // Heat 1 is over: Vaast won it, 17.04 to 13.17.
    const vaast = within(heats[0]).getByText("Kauli Vaast").closest("li")!;
    expect(vaast).toHaveTextContent("Kauli Vaast, won17.04");
    expect(within(vaast).getByText("Kauli Vaast")).toHaveClass("font-semibold");
    expect(within(heats[0]).getByText("Yago Dora").closest("li")).toHaveClass("text-muted-foreground");
    // In the water: nobody has won yet.
    expect(heats[1]).not.toHaveTextContent(", won");
    // Not surfed yet: no totals.
    expect(within(heats[2]).getByText("Jack Robinson").closest("li")).not.toHaveTextContent(/\d/);

    const quarters = screen.getByRole("heading", { level: 2, name: "Quarterfinals" }).closest("section")!;
    expect(within(quarters).getByText("Winner of Heat 1").closest("li")).toHaveClass("text-muted-foreground");
  });

  it("hides every face from assistive tech", () => {
    const withFaces: SurfData = {
      ...SURF_DATA,
      rankings: SURF_DATA.rankings.map((r) => ({ ...r, imageUrl: `https://img.example/${r.athleteId}.png` })),
    };
    const { container } = render(<SurfView data={withFaces} initialTab="overview" />);
    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) expect(img).toHaveAttribute("alt", "");
  });

  it("says so when the tour has no events", () => {
    render(<SurfView data={{ season: 2026, events: [], rankings: [] }} />);
    expect(screen.getByText("No events on the calendar for this tour.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Draw" })).toBeDisabled();
  });

  it("has a News tab with Stab's stories, opened by ?tab=news", () => {
    const story = {
      id: "stab-1",
      headline: "Griff Is The King Of Peniche",
      description: null,
      href: "https://stabmag.com/news/griff/",
      external: true,
      image: null,
      at: "2026-10-23T21:34:34Z",
      kind: "story" as const,
      about: [],
    };
    render(<SurfView data={SURF_DATA} news={[story]} initialTab="news" />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Draw", "News"]);
    expect(openTab()).toBe("News");
    expect(screen.getByRole("heading", { name: "Griff Is The King Of Peniche" })).toBeInTheDocument();
  });
});
