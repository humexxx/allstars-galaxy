import { scrollParent } from "./scroll";

/**
 * How a list brings in more of itself — earlier match days, earlier or later
 * races — without a jump: what moves slides, what is new fades in.
 */
export const SLIDE_MS = 220;
export const FADE_MS = 200;
export const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** A reader who asked for less motion, or a runtime with no Web Animations API (a test). */
export function holdStill(el: HTMLElement): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true ||
    typeof el.animate !== "function"
  );
}

/** Fades `el` in from a little above, after `delay`. */
export function fadeIn(el: HTMLElement, delay = 0): void {
  if (holdStill(el)) return;
  el.animate(
    [
      { opacity: 0, transform: "translateY(-0.5rem)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: FADE_MS, delay, easing: EASE, fill: "backwards" }
  );
}

/**
 * Keeps the page where it is while a list grows. Left alone, the browser's
 * scroll anchoring scrolls by the height added above whatever it anchored
 * on, to keep that in place, and what was added lands off the screen.
 * Anchoring comes back once the slide is over.
 */
export function holdScrollStill(list: HTMLElement): void {
  const scroller = scrollParent(list);
  const held = scroller ? [scroller] : [document.documentElement, document.body];
  for (const el of held) el.style.overflowAnchor = "none";
  window.setTimeout(() => {
    for (const el of held) el.style.overflowAnchor = "";
  }, SLIDE_MS + FADE_MS);
}
