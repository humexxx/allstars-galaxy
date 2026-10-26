"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

import { prefersReducedMotion } from "./reveal";
import { RotationButton } from "./rotation-button";
import { useAutoAdvance } from "./use-auto-advance";

/**
 * The news rail's scrolling row, under its heading: it steps on one story at a
 * time by itself and back to the first after the last, with a pause button at
 * the heading's end.
 */
export function NewsRailTrack({
  label,
  heading,
  children,
}: {
  label: string;
  heading: ReactNode;
  children: ReactNode;
}): React.ReactElement {
  const region = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const count = Children.count(children);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const follow = (): void => setAt(Math.round(el.scrollLeft));
    el.addEventListener("scroll", follow, { passive: true });
    return () => el.removeEventListener("scroll", follow);
  }, []);

  const rotation = useAutoAdvance({
    region,
    track,
    count,
    at,
    advance: () => {
      const el = track.current;
      const card = el?.firstElementChild;
      if (!el || !(card instanceof HTMLElement)) return;
      const behavior = prefersReducedMotion() ? "auto" : "smooth";
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if (atEnd) el.scrollTo({ left: 0, behavior });
      else el.scrollBy({ left: card.offsetWidth + Number.parseFloat(getComputedStyle(el).columnGap || "0"), behavior });
    },
  });

  return (
    <div ref={region} role="region" aria-roledescription="carousel" aria-label={label} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        {heading}
        <RotationButton rotation={rotation} what="news" className="-my-1.5" />
      </div>
      <div
        ref={track}
        aria-live={rotation.rotating ? "off" : "polite"}
        className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1"
      >
        {children}
      </div>
    </div>
  );
}
