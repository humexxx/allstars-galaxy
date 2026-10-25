// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LeadCarousel } from "./lead-carousel";

function renderGames(count: number): HTMLElement {
  render(
    <LeadCarousel label="Games">
      {Array.from({ length: count }, (_, i) => (
        <a key={i} href={`/game/${i + 1}`}>
          Game {i + 1}
        </a>
      ))}
    </LeadCarousel>
  );
  const track = screen.getByRole("group", { name: `1 of ${count}` }).parentElement!;
  // jsdom lays nothing out: the track is one game wide.
  Object.defineProperty(track, "clientWidth", { configurable: true, value: 300 });
  return track;
}

const dots = (): HTMLElement[] => screen.getAllByRole("button", { name: /^Show game/ });
const current = (): number => dots().findIndex((dot) => dot.getAttribute("aria-current") === "true");

describe("LeadCarousel", () => {
  it("is just the game when there is one, with no dots", () => {
    render(
      <LeadCarousel label="Games">
        <a href="/game/1">Game 1</a>
      </LeadCarousel>
    );
    expect(screen.getByRole("link", { name: "Game 1" })).toBeInTheDocument();
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names itself and each game, a dot for each, the first one current", () => {
    renderGames(3);
    const carousel = screen.getByRole("region", { name: "Games" });
    expect(within(carousel).getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual([
      "1 of 3",
      "2 of 3",
      "3 of 3",
    ]);
    expect(dots().map((dot) => dot.getAttribute("aria-label"))).toEqual([
      "Show game 1 of 3",
      "Show game 2 of 3",
      "Show game 3 of 3",
    ]);
    expect(current()).toBe(0);
  });

  it("scrolls to the game a dot names", () => {
    const track = renderGames(3);
    track.scrollTo = vi.fn();
    fireEvent.click(dots()[2]);
    expect(track.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 600 }));
  });

  it("follows wherever the scroll lands, a swipe or a tab into a later game", () => {
    const track = renderGames(3);
    track.scrollLeft = 300;
    fireEvent.scroll(track);
    expect(current()).toBe(1);
  });
});
