"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { prefersReducedMotion } from "./reveal";

/**
 * A dashboard card's lead box stepping through games, one at a time, with a
 * dot for each in the box's bottom right corner. The track is a scroll-snap
 * row: a swipe moves it natively, a keyboard user tabbing into a later game
 * scrolls it in, and the dots follow wherever the scroll lands. One game is
 * just the game, with no dots.
 */
export function LeadCarousel({ label, children }: { label: string; children: ReactNode }): React.ReactElement {
  const slides = Children.toArray(children);
  const many = slides.length > 1;
  const track = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);

  // The track only exists with two games or more, so the listener comes and
  // goes with it.
  useEffect(() => {
    const el = track.current;
    if (!many || !el) return;
    const follow = (): void => setShown(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", follow, { passive: true });
    return () => el.removeEventListener("scroll", follow);
  }, [many]);

  if (!many) return <>{slides}</>;

  const show = (index: number): void => {
    const el = track.current;
    el?.scrollTo({ left: index * el.clientWidth, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label} className="relative h-full">
      <div ref={track} className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            className="h-full w-full shrink-0 snap-start"
          >
            {slide}
          </div>
        ))}
      </div>
      {/* 24px targets, the least a pointer is given; the dot shown is longer
          and darker than the rest, each still clear of the card's background. */}
      <div className="absolute right-1 bottom-0 flex">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show game ${i + 1} of ${slides.length}`}
            aria-current={i === shown}
            onClick={() => show(i)}
            className="grid size-6 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === shown ? "w-3 bg-foreground" : "w-1.5 bg-muted-foreground"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
