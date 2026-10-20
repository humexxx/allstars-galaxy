"use client";

import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { BannerSlide } from "@/lib/travel/banner-slides";
import { cn } from "@/lib/utils";

import { TripPhoto } from "./trip-photo";

const TURN_MS = 5000;

/**
 * Which slide is showing. One every five seconds, and a slide picked by hand
 * gets its full five before the next. Holds still under reduced motion.
 *
 * While a proposal marks some slides, only those take turns: the banner is
 * there to show what would change, not the photos that stay.
 */
export function useBannerCarousel(slides: BannerSlide[]): { index: number; show: (i: number) => void } {
  const reduced = usePrefersReducedMotion();
  const [chosen, setChosen] = useState(0);
  const marked = slides.flatMap((s, i) => (s.mark ? [i] : []));
  const turns = marked.length > 0 ? marked : slides.map((_, i) => i);
  // A slide can disappear under the index (a photo removed): fall back.
  const index = turns.includes(chosen) ? chosen : (turns[0] ?? 0);
  const order = turns.join(",");

  useEffect(() => {
    const ring = order ? order.split(",").map(Number) : [];
    if (reduced || ring.length < 2) return;
    const next = ring[(ring.indexOf(index) + 1) % ring.length];
    const timer = setTimeout(() => setChosen(next), TURN_MS);
    return () => clearTimeout(timer);
  }, [index, order, reduced]);

  return { index, show: setChosen };
}

/**
 * The photographs, stacked, crossfading into one another. Fills its
 * (relative) parent and sits under whatever is drawn after it.
 */
export function BannerSlides({ slides, index }: { slides: BannerSlide[]; index: number }) {
  return slides.map((slide, i) => (
    <div
      key={slide.id}
      aria-hidden={i !== index}
      className={cn(
        "absolute inset-0 transition-opacity duration-1000 ease-in-out",
        i === index ? "opacity-100" : "opacity-0",
        slide.mark === "remove" && "grayscale"
      )}
    >
      <TripPhoto
        src={slide.url}
        alt={slide.alt}
        priority={i === 0}
        sizes="(max-width: 1024px) 100vw, 1024px"
        fallback="none"
      />
    </div>
  ));
}

/**
 * One dot per photo along the banner's bottom edge, the current one drawn
 * long. Inside the banner's bottom padding, so it never runs into the dates.
 */
export function BannerDots({
  slides,
  index,
  onShow,
}: {
  slides: BannerSlide[];
  index: number;
  onShow: (i: number) => void;
}) {
  if (slides.length < 2) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-1 z-10 flex justify-center gap-1">
      {slides.map((slide, i) => (
        <button
          key={slide.id}
          type="button"
          onClick={() => onShow(i)}
          aria-label={`Photo ${i + 1} of ${slides.length}`}
          aria-current={i === index}
          className="pointer-events-auto flex h-3 items-center px-0.5"
        >
          <span
            className={cn(
              "h-1.5 rounded-full shadow-sm transition-all duration-300",
              i === index ? "w-4 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80",
              slide.mark && (slide.mark === "remove" ? "ring-2 ring-destructive" : "ring-2 ring-primary")
            )}
          />
        </button>
      ))}
    </div>
  );
}

/** Slides and dots together, for a banner with nothing else to say about them. */
export function BannerPhotos({ slides }: { slides: BannerSlide[] }) {
  const { index, show } = useBannerCarousel(slides);
  return (
    <>
      <BannerSlides slides={slides} index={index} />
      <BannerDots slides={slides} index={index} onShow={show} />
    </>
  );
}
