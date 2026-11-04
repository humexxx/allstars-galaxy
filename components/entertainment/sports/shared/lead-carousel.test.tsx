// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeadCarousel } from "./lead-carousel";
import { ADVANCE_MS } from "./use-auto-advance";

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

  describe("moving on by itself", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    function rotating(count = 3): { track: HTMLElement; scrollTo: ReturnType<typeof vi.fn> } {
      vi.useFakeTimers();
      const track = renderGames(count);
      const scrollTo = vi.fn();
      track.scrollTo = scrollTo;
      return { track, scrollTo };
    }
    const wait = (ms: number): void => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    };

    it("shows the next game after a while, and back to the first after the last", () => {
      const { track, scrollTo } = rotating();
      wait(ADVANCE_MS - 1);
      expect(scrollTo).not.toHaveBeenCalled();
      wait(1);
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 300 }));

      track.scrollLeft = 600;
      fireEvent.scroll(track);
      wait(ADVANCE_MS);
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 0 }));
    });

    it("keeps quiet for screen readers while it moves by itself", () => {
      const { track } = rotating();
      expect(track).toHaveAttribute("aria-live", "off");
      fireEvent.click(screen.getByRole("button", { name: "Pause games" }));
      expect(track).toHaveAttribute("aria-live", "polite");
    });

    it("holds while the pointer is over it or focus is inside it", () => {
      const { scrollTo } = rotating();
      const carousel = screen.getByRole("region", { name: "Games" });
      fireEvent.pointerEnter(carousel);
      wait(ADVANCE_MS * 2);
      expect(scrollTo).not.toHaveBeenCalled();
      fireEvent.pointerLeave(carousel);

      fireEvent.focusIn(screen.getByRole("link", { name: "Game 1" }));
      wait(ADVANCE_MS * 2);
      expect(scrollTo).not.toHaveBeenCalled();
      fireEvent.focusOut(screen.getByRole("link", { name: "Game 1" }), { relatedTarget: document.body });
      wait(ADVANCE_MS);
      expect(scrollTo).toHaveBeenCalledTimes(1);
    });

    it("stops for good once the reader picks a game", () => {
      const { scrollTo } = rotating();
      fireEvent.click(dots()[2]);
      scrollTo.mockClear();
      wait(ADVANCE_MS * 3);
      expect(scrollTo).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Play games" })).toBeInTheDocument();
    });

    it("stops for good once the reader swipes it", () => {
      const { track, scrollTo } = rotating();
      fireEvent.pointerDown(track);
      wait(ADVANCE_MS * 3);
      expect(scrollTo).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Play games" })).toBeInTheDocument();
    });

    it("pauses and plays again from its button", () => {
      const { scrollTo } = rotating();
      fireEvent.click(screen.getByRole("button", { name: "Pause games" }));
      wait(ADVANCE_MS * 2);
      expect(scrollTo).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Play games" }));
      wait(ADVANCE_MS);
      expect(scrollTo).toHaveBeenCalledTimes(1);
    });

    it("never moves, and has no button, for a reader who asked for less motion", () => {
      const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
        (query: string) =>
          ({
            matches: query.includes("reduce"),
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList
      );
      const { scrollTo } = rotating();
      wait(ADVANCE_MS * 2);
      expect(scrollTo).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: /Pause|Play/ })).toBeNull();
      matchMedia.mockRestore();
    });
  });
});
