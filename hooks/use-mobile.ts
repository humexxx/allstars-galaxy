import * as React from "react";

/** A `(max-width: …)` media query as a store `useSyncExternalStore` reads. */
function belowWidth(px: number) {
  const query = `(max-width: ${px - 1}px)`;
  return {
    subscribe(onChange: () => void) {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    getSnapshot() {
      return window.matchMedia(query).matches;
    },
  };
}

function getServerSnapshot() {
  return false;
}

const mobile = belowWidth(768);
const belowLg = belowWidth(1024);

export function useIsMobile() {
  return React.useSyncExternalStore(mobile.subscribe, mobile.getSnapshot, getServerSnapshot);
}

/**
 * Under Tailwind's `lg` (1024px), where the portal's sidebar is a sheet: on a
 * tablet a fixed 192px sidebar left the page 512px of 768.
 */
export function useIsBelowLg() {
  return React.useSyncExternalStore(belowLg.subscribe, belowLg.getSnapshot, getServerSnapshot);
}
