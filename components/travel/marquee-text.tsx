"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Text that slides into view on hover, but only when it does not fit.
 *
 * A calendar bar can be one day wide, and "Star of the Seas — Western
 * Caribbean" truncated to "Star of…" tells you nothing. Rather than widen
 * every bar for the longest title, the label walks left while the pointer is
 * on it and returns when it leaves.
 *
 * Text that already fits is left completely alone — nothing to reveal, and a
 * label that drifts for no reason is just noise. The measurement is what
 * decides, so the same component is inert on a short title and animated on a
 * long one.
 */
export function MarqueeText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const text = el.firstElementChild as HTMLElement | null;
      if (!text) return;
      // Rounded because sub-pixel widths make a fitting label look 0.4px
      // short and animate for no reason.
      setOverflow(Math.max(0, Math.round(text.scrollWidth - el.clientWidth)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);

  return (
    <span
      ref={box}
      className={cn("relative block min-w-0 overflow-hidden", className)}
      data-marquee={overflow > 0 ? "true" : undefined}
      style={
        overflow > 0
          ? ({
              // Distance and pace travel together so a long title is not
              // slower to read than a short one — 30px a second either way.
              "--marquee-shift": `-${overflow}px`,
              "--marquee-duration": `${Math.max(1.5, overflow / 30)}s`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <span className={cn("block", overflow > 0 ? "w-max" : "truncate")}>
        {children}
      </span>
    </span>
  );
}
