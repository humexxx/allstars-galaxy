// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { F1_DATA } from "@/lib/data/sports/f1";
import { getFootballLeague } from "@/lib/data/sports/football";
import { NBA_DATA } from "@/lib/data/sports/nba";
import type { SportPayload } from "@/lib/sports/payload";
import type { SportId } from "@/types/sports";

import { forgetSeenSports, rememberSport, seenKey } from "./seen-sports";
import { SportsHub } from "./sports-hub";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/actions/sports", () => ({
  setSportFavoriteAction: vi.fn(),
  setSportTeamFilterAction: vi.fn(),
}));
vi.mock("@/app/actions/racquet", () => ({ getRacquetDrawAction: vi.fn() }));
vi.mock("@/app/actions/lol", () => ({ getLolSplitAction: vi.fn() }));

const NBA: SportPayload = { sport: "nba", data: { ...NBA_DATA, playoffs: [] } };
const F1: SportPayload = { sport: "f1", data: F1_DATA, news: [] };
const LEAGUES = [
  { id: "premier-league", name: "Premier League" },
  { id: "la-liga", name: "La Liga" },
] as const;
const football = (id: (typeof LEAGUES)[number]["id"]): SportPayload => ({
  sport: "football",
  league: getFootballLeague(id),
  options: LEAGUES,
});

function hub(activeSport: SportId = "nba", payload: SportPayload = NBA, viewerId = "viewer-1"): React.ReactElement {
  return (
    <SportsHub
      activeSport={activeSport}
      favoriteSportIds={["f1", "nba"]}
      payload={payload}
      today="2026-10-18"
      viewerId={viewerId}
    />
  );
}

function renderHub(
  activeSport: SportId = "nba",
  payload: SportPayload = NBA,
  viewerId = "viewer-1"
): ReturnType<typeof render> {
  return render(hub(activeSport, payload, viewerId));
}

beforeEach(() => {
  forgetSeenSports();
});

const picker = (): HTMLElement => screen.getByRole("group", { name: "Sports" });
const favorites = (): HTMLElement => screen.getByRole("button", { name: "Manage favorites (2)" });
const sport = (name: RegExp | string): HTMLElement => within(picker()).getByRole("link", { name });
const title = (name: RegExp): HTMLElement =>
  within(screen.getByRole("heading", { level: 1 })).getByRole("button", { name });

/**
 * The server answers when a test says so, and every answer still owed is
 * given after the test: React holds every transition, in any root, until an
 * async one still pending settles, so one left hanging stalls the next test's.
 */
const answers: Array<() => void> = [];
const answerLater = (): void => {
  push.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        answers.push(resolve);
      })
  );
};
const answer = (): Promise<void> =>
  act(async () => {
    for (const resolve of answers.splice(0)) resolve();
  });

afterEach(async () => {
  await answer();
  push.mockReset();
});

describe("SportsHub", () => {
  it("has no page header: the sport's own bar is the page's one h1", () => {
    renderHub();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("NBA");
    expect(screen.queryByRole("heading", { name: "Sports" })).toBeNull();
  });

  it("has no strip of sports above the bar any more", () => {
    renderHub();
    expect(screen.queryByRole("navigation", { name: "Sports" })).toBeNull();
  });

  it("ends the name row with the favourites button, the count on it, then the sports", () => {
    renderHub();
    const controls = picker().parentElement;
    expect(controls?.firstElementChild).toBe(favorites());
    expect(controls?.lastElementChild).toBe(picker());
    expect(favorites()).toHaveTextContent("2");

    const nameRow = controls?.parentElement;
    expect(nameRow).toContainElement(screen.getByRole("heading", { level: 1 }));
    expect(nameRow?.lastElementChild).toBe(controls);
    expect(nameRow).not.toContainElement(screen.getByRole("tablist"));
  });

  it("groups every sport, the favourites first, each a link to its page", () => {
    renderHub();
    const links = within(picker()).getAllByRole("link");

    // Favourites keep the registry's order among themselves (F1 before NBA),
    // and so do the rest.
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/portal/entertainment/sports?sport=f1",
      "/portal/entertainment/sports?sport=nba",
      "/portal/entertainment/sports?sport=football",
      "/portal/entertainment/sports?sport=padel",
      "/portal/entertainment/sports?sport=tennis",
      "/portal/entertainment/sports?sport=nfl",
      "/portal/entertainment/sports?sport=lol",
    ]);
    const [f1, nba, football, ...others] = links;
    expect(f1).toHaveAccessibleName("F1 (favorite)");
    expect(nba).toHaveAccessibleName("NBA (favorite)");
    expect(football).toHaveAccessibleName("Football");
    for (const link of others) expect(link).not.toHaveAccessibleName(/\(favorite\)/);
  });

  it("marks the sport on screen, every sport by its emoji and name", () => {
    renderHub();
    const current = within(picker()).getByRole("link", { current: "page" });
    expect(current).toHaveAccessibleName("NBA (favorite)");
    expect(current).toHaveTextContent(/^🏀NBA$/);
    expect(sport("Football")).toHaveTextContent(/^⚽Football$/);
    expect(within(picker()).getAllByRole("link", { current: false })).toHaveLength(6);
  });

  it("moves to a sport in its own transition, and leaves a modified click to the browser", () => {
    // jsdom cannot open the new tab a modified click asks the browser for.
    const stayPut = (event: Event): void => event.preventDefault();
    document.addEventListener("click", stayPut);
    renderHub();

    fireEvent.click(sport("Football"), { metaKey: true });
    expect(push).not.toHaveBeenCalled();

    // The sport already on screen goes nowhere.
    fireEvent.click(sport(/^NBA/));
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(sport("Football"));
    expect(push).toHaveBeenCalledWith("?sport=football", { scroll: false });
    document.removeEventListener("click", stayPut);
  });

  describe("going back to a sport", () => {
    // The server has not answered yet: the transition stays pending.
    beforeEach(answerLater);
    const go = (name: RegExp): void => {
      fireEvent.click(sport(name));
    };

    it("shows the copy last seen of it at once while the fresh one loads", async () => {
      renderHub("f1", F1).unmount();
      renderHub();
      go(/^F1/);

      expect(await screen.findByRole("heading", { level: 1, name: "Formula 1" })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Loading Formula 1…");
    });

    it("is a skeleton for a sport not seen yet in this visit", async () => {
      renderHub();
      go(/^Football/);

      expect(await screen.findByRole("status")).toHaveTextContent("Loading Football…");
      expect(screen.queryByRole("heading", { level: 1, hidden: true })).toBeNull();
    });

    it("keeps the favourites and the sports, on the sport coming, usable over its skeleton", async () => {
      renderHub();
      go(/^Football/);

      expect(await screen.findByRole("status")).toHaveTextContent("Loading Football…");
      expect(picker().parentElement?.firstElementChild).toBe(favorites());
      expect(within(picker()).getByRole("link", { current: "page" })).toHaveAccessibleName("Football");
    });

    it("never shows another account's copy", async () => {
      renderHub("f1", F1, "admin").unmount();
      renderHub("nba", NBA, "client");
      go(/^F1/);

      expect(await screen.findByRole("status")).toHaveTextContent("Loading Formula 1…");
      expect(screen.queryByRole("heading", { level: 1, hidden: true })).toBeNull();
    });
  });

  describe("giving focus back after a move", () => {
    beforeEach(answerLater);
    const pickSport = (name: RegExp): void => {
      sport(name).focus();
      fireEvent.click(sport(name));
    };
    const pickLeague = (name: string): void => {
      // Radix opens its menu on pointerdown, which jsdom's clicks lack; Enter opens it too.
      fireEvent.keyDown(title(/Premier League/), { key: "Enter" });
      const league = within(screen.getByRole("menu")).getByRole("menuitemradio", { name });
      league.focus();
      fireEvent.keyDown(league, { key: "Enter" });
    };
    /** Radix gives focus back to a closed menu's trigger a task later. */
    const afterMenuCloses = (): Promise<void> =>
      act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

    it("keeps it on the sport picked, over its skeleton and then in its view", async () => {
      const { rerender } = renderHub();
      const clicked = sport(/^Football/);
      pickSport(/^Football/);

      expect(screen.getByRole("status")).toHaveTextContent("Loading Football…");
      expect(sport(/^Football/)).not.toBe(clicked);
      expect(sport(/^Football/)).toHaveFocus();

      rerender(hub("football", football("premier-league")));
      await answer();

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Premier League");
      expect(within(picker()).getByRole("link", { current: "page" })).toHaveAccessibleName("Football");
      expect(sport(/^Football/)).toHaveFocus();
    });

    it("keeps it on the sport picked in the copy last seen of it", async () => {
      renderHub("f1", F1).unmount();
      renderHub();
      pickSport(/^F1/);

      expect(await screen.findByRole("heading", { level: 1, name: "Formula 1" })).toBeInTheDocument();
      expect(sport(/^F1/)).toHaveFocus();
    });

    it("keeps it on a sport picked over another's skeleton, back to the one on screen", async () => {
      renderHub("f1", F1);
      pickSport(/^Football/);
      expect(screen.getByRole("status")).toHaveTextContent("Loading Football…");

      // F1's copy takes the skeleton's place under the same key as the page on screen.
      pickSport(/^F1/);

      expect(await screen.findByRole("heading", { level: 1, name: "Formula 1" })).toBeInTheDocument();
      expect(sport(/^F1/)).toHaveFocus();
    });

    it("puts it on the title once a league picked from its menu lands", async () => {
      const { rerender } = renderHub("football", football("premier-league"));
      pickLeague("La Liga");

      expect(push).toHaveBeenCalledWith("?sport=football&league=la-liga", { scroll: false });
      expect(screen.queryByRole("heading", { level: 1, hidden: true })).toBeNull();

      rerender(hub("football", football("la-liga")));
      await answer();

      expect(title(/La Liga/)).toHaveFocus();
    });

    it("puts it straight on the title of a league's copy, and Radix leaves it there", async () => {
      rememberSport("viewer-1", seenKey("football", "la-liga"), {
        payload: football("la-liga"),
        teamFilter: null,
        today: "2026-10-18",
      });
      renderHub("football", football("premier-league"));
      pickLeague("La Liga");

      expect(title(/La Liga/)).toHaveFocus();
      await afterMenuCloses();
      expect(title(/La Liga/)).toHaveFocus();
    });

    it("leaves it where the reader moved it while the sport loaded", async () => {
      const elsewhere = document.body.appendChild(document.createElement("button"));
      onTestFinished(() => elsewhere.remove());
      const { rerender } = renderHub();
      pickSport(/^Football/);
      elsewhere.focus();

      rerender(hub("football", football("premier-league")));
      await answer();

      expect(elsewhere).toHaveFocus();
    });
  });
});
