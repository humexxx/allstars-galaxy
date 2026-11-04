// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bannerSlides, type BannerSlide } from "@/lib/travel/banner-slides";

import { BannerPhotos } from "./banner-photos";

const slides = (n: number, marks: Record<number, BannerSlide["mark"]> = {}): BannerSlide[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, url: `https://cdn.test/${i}.jpg`, alt: `Photo ${i}`, mark: marks[i] }));

const showing = (): number =>
  screen.getAllByRole("button", { name: /^Photo \d+ of/ }).findIndex((b) => b.getAttribute("aria-current") === "true");

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("BannerPhotos", () => {
  it("moves to the next photo every five seconds, back to the first after the last", () => {
    render(<BannerPhotos slides={slides(3)} />);
    expect(showing()).toBe(0);
    act(() => vi.advanceTimersByTime(4999));
    expect(showing()).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    expect(showing()).toBe(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(showing()).toBe(2);
    act(() => vi.advanceTimersByTime(5000));
    expect(showing()).toBe(0);
  });

  it("gives a photo picked by hand its full five seconds", () => {
    render(<BannerPhotos slides={slides(3)} />);
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.click(screen.getByRole("button", { name: "Photo 3 of 3" }));
    act(() => vi.advanceTimersByTime(4000));
    expect(showing()).toBe(2);
    act(() => vi.advanceTimersByTime(1000));
    expect(showing()).toBe(0);
  });

  it("only turns through the photos a proposal marks", () => {
    render(<BannerPhotos slides={slides(4, { 1: "add", 3: "remove" })} />);
    expect(showing()).toBe(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(showing()).toBe(3);
    act(() => vi.advanceTimersByTime(5000));
    expect(showing()).toBe(1);
  });

  it("draws no dots and never moves for a single photo", () => {
    render(<BannerPhotos slides={slides(1)} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByAltText("Photo 0")).toBeInTheDocument();
  });
});

describe("bannerSlides", () => {
  it("puts the cover first, then the trip's own photos, leaving out an activity's", () => {
    const result = bannerSlides({
      title: "Orlando",
      coverPhotoUrl: "https://cdn.test/cover.jpg",
      photos: [
        { id: "a", url: "https://cdn.test/a.jpg", caption: null, itemId: null },
        { id: "b", url: "https://cdn.test/b.jpg", caption: "On the boat", itemId: "item-1" },
        { id: "c", url: "https://cdn.test/c.jpg", caption: "Beach", itemId: null },
      ],
    });
    expect(result.map((s) => [s.id, s.alt])).toEqual([
      ["cover", "Orlando cover photo"],
      ["a", "Orlando photo 1"],
      ["c", "Beach"],
    ]);
  });
});
