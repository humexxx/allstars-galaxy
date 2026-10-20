// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NBA_DATA } from "@/lib/data/sports/nba";

import { SportsHub } from "./sports-hub";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/actions/sports", () => ({
  setSportFavoriteAction: vi.fn(),
  setSportTeamFilterAction: vi.fn(),
}));
vi.mock("@/app/actions/racquet", () => ({ getRacquetDrawAction: vi.fn() }));
vi.mock("@/app/actions/f1", () => ({ getF1RaceClassificationAction: vi.fn() }));

function renderHub(): ReturnType<typeof render> {
  return render(
    <SportsHub
      activeSport="nba"
      favoriteSportIds={["f1", "nba"]}
      payload={{ sport: "nba", data: { ...NBA_DATA, playoffs: [] } }}
      today="2026-10-18"
    />
  );
}

const strip = (): HTMLElement => screen.getByRole("navigation", { name: "Sports" });

afterEach(() => {
  push.mockClear();
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
});
