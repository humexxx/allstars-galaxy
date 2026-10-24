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
vi.mock("@/app/actions/f1", () => ({ getF1RaceClassificationAction: vi.fn() }));

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

const strip = (): HTMLElement => screen.getByRole("navigation", { name: "Sports" });

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

  it("leads the strip with the favourites, starred, and marks the sport on screen", () => {
    renderHub();
    const [first, second, third] = within(strip()).getAllByRole("link");
    // Favourites keep the registry's order among themselves (F1 before NBA).
    expect(first).toHaveAccessibleName(/^F1.*\(favorite\)$/);
    expect(second).toHaveAccessibleName(/^NBA.*\(favorite\)$/);
    expect(third).toHaveAccessibleName("Football");
    expect(within(strip()).getByRole("link", { current: "page" })).toHaveTextContent("NBA");
  });

  it("ends the strip's row with the favourites button, the count on it", () => {
    renderHub();
    const button = screen.getByRole("button", { name: "Manage favorites (2)" });
    expect(button).toHaveTextContent("2");
    expect(strip().contains(button)).toBe(false);
    expect(strip().parentElement?.lastElementChild).toBe(button);
  });

  it("moves to a sport in its own transition, and leaves a modified click to the browser", () => {
    // jsdom cannot open the new tab a modified click asks the browser for.
    const stayPut = (event: Event): void => event.preventDefault();
    document.addEventListener("click", stayPut);
    renderHub();
    const football = within(strip()).getByRole("link", { name: /Football/ });

    fireEvent.click(football, { metaKey: true });
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(football);
    expect(push).toHaveBeenCalledWith("?sport=football", { scroll: false });
    document.removeEventListener("click", stayPut);
  });

  describe("going back to a sport", () => {
    // The server has not answered yet: the transition stays pending.
    beforeEach(() => {
      push.mockImplementation(() => new Promise(() => {}));
    });
    const go = (name: RegExp): void => {
      fireEvent.click(within(strip()).getByRole("link", { name }));
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
      expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    });

    it("never shows another account's copy", async () => {
      renderHub("f1", F1, "admin").unmount();
      renderHub("nba", NBA, "client");
      go(/^F1/);

      expect(await screen.findByRole("status")).toHaveTextContent("Loading Formula 1…");
      expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    });
  });
});
