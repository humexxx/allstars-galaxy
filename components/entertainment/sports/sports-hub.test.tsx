// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { F1_DATA } from "@/lib/data/sports/f1";
import { NBA_DATA } from "@/lib/data/sports/nba";
import type { SportPayload } from "@/lib/sports/payload";
import type { SportId } from "@/types/sports";

import { forgetSeenSports } from "./seen-sports";
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

function renderHub(
  activeSport: SportId = "nba",
  payload: SportPayload = NBA,
  viewerId = "viewer-1"
): ReturnType<typeof render> {
  return render(
    <SportsHub
      activeSport={activeSport}
      favoriteSportIds={["f1", "nba"]}
      payload={payload}
      today="2026-10-18"
      viewerId={viewerId}
    />
  );
}

beforeEach(() => {
  forgetSeenSports();
});

const picker = (): HTMLElement => screen.getByRole("button", { name: /change sport$/ });
const favorites = (): HTMLElement => screen.getByRole("button", { name: "Manage favorites (2)" });

/** Radix opens its menu on pointerdown, which jsdom's clicks lack; Enter opens it too. */
function openPicker(): HTMLElement {
  fireEvent.keyDown(picker(), { key: "Enter" });
  return screen.getByRole("menu");
}

afterEach(() => {
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
    expect(screen.queryByRole("link", { name: /Football/ })).toBeNull();
  });

  it("ends the name row with the favourites button, the count on it, then the sport picker", () => {
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

  it("names the sport on screen on the picker", () => {
    renderHub();
    expect(picker()).toHaveAccessibleName(/^NBA\s*, change sport$/);
    expect(picker()).toHaveAttribute("aria-haspopup", "menu");
  });

  it("names the sport by its short label, F1 for Formula 1", () => {
    renderHub("f1", F1);
    expect(picker()).toHaveAccessibleName(/^F1\s*, change sport$/);
  });

  it("lists every sport in its menu, the favourites first and starred, a line, then the rest", () => {
    renderHub();
    const menu = openPicker();
    const items = within(menu).getAllByRole("menuitem");

    // Favourites keep the registry's order among themselves (F1 before NBA),
    // and so do the rest.
    expect(items.map((item) => item.getAttribute("href"))).toEqual([
      "?sport=f1",
      "?sport=nba",
      "?sport=football",
      "?sport=padel",
      "?sport=tennis",
      "?sport=nfl",
      "?sport=lol",
    ]);
    const [f1, nba, football, ...others] = items;
    expect(f1).toHaveAccessibleName(/^F1.*\(favorite\)$/);
    expect(nba).toHaveAccessibleName(/^NBA.*\(favorite\)$/);
    expect(football).toHaveAccessibleName("Football");
    for (const item of others) expect(item).not.toHaveAccessibleName(/\(favorite\)/);

    const separator = within(menu).getByRole("separator");
    expect(separator.previousElementSibling).toBe(nba);
    expect(separator.nextElementSibling).toBe(football);
  });

  it("marks the sport on screen in the menu", () => {
    renderHub();
    const menu = openPicker();
    expect(within(menu).getByRole("menuitem", { current: "page" })).toHaveAccessibleName(/^NBA/);
    expect(within(menu).getAllByRole("menuitem", { current: false })).toHaveLength(6);
  });

  it("moves to a sport in its own transition, and leaves a modified click to the browser", () => {
    // jsdom cannot open the new tab a modified click asks the browser for.
    const stayPut = (event: Event): void => event.preventDefault();
    document.addEventListener("click", stayPut);
    renderHub();

    fireEvent.click(within(openPicker()).getByRole("menuitem", { name: "Football" }), { metaKey: true });
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(within(openPicker()).getByRole("menuitem", { name: "Football" }));
    expect(push).toHaveBeenCalledWith("?sport=football", { scroll: false });
    document.removeEventListener("click", stayPut);
  });

  describe("going back to a sport", () => {
    // The server has not answered yet: the transition stays pending.
    beforeEach(() => {
      push.mockImplementation(() => new Promise(() => {}));
    });
    const go = (name: RegExp): void => {
      fireEvent.click(within(openPicker()).getByRole("menuitem", { name }));
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
      // Hidden ones too: an open menu would hide the page from the query.
      expect(screen.queryByRole("heading", { level: 1, hidden: true })).toBeNull();
    });

    it("keeps the favourites and the picker, on the sport coming, usable over its skeleton", async () => {
      renderHub();
      go(/^Football/);

      expect(await screen.findByRole("status")).toHaveTextContent("Loading Football…");
      expect(picker()).toHaveAccessibleName(/^Football\s*, change sport$/);
      expect(picker().parentElement?.firstElementChild).toBe(favorites());
      expect(within(openPicker()).getByRole("menuitem", { current: "page" })).toHaveAccessibleName(
        "Football"
      );
    });

    it("never shows another account's copy", async () => {
      renderHub("f1", F1, "admin").unmount();
      renderHub("nba", NBA, "client");
      go(/^F1/);

      expect(await screen.findByRole("status")).toHaveTextContent("Loading Formula 1…");
      expect(screen.queryByRole("heading", { level: 1, hidden: true })).toBeNull();
    });
  });
});
