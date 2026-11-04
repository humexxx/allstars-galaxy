"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/** Long enough to read a headline or a fixture before it moves on. */
export const ADVANCE_MS = 7000;

export interface AutoAdvance {
  /** False under reduced motion: nothing moves, so there is nothing to pause. */
  available: boolean;
  /** Not paused by the reader (a hover or a focus only holds it). */
  playing: boolean;
  /** For the region's `aria-live`: announce a slide only when the reader moved it. */
  rotating: boolean;
  toggle: () => void;
  stop: () => void;
}

/**
 * Moves a dashboard carousel on by itself, as the WAI-ARIA carousel pattern
 * asks: it holds while the pointer is over the region or focus is inside it,
 * waits while the region is off screen or the tab hidden, stops for good once
 * the reader moves it themselves (a swipe, a wheel, a dot) and never runs under
 * reduced motion. `at` is where the carousel stands, so a move by hand gets a
 * full turn before the next.
 */
export function useAutoAdvance({
  region,
  track,
  count,
  at,
  advance,
}: {
  region: RefObject<HTMLElement | null>;
  track: RefObject<HTMLElement | null>;
  count: number;
  at: number;
  advance: () => void;
}): AutoAdvance {
  const reduced = usePrefersReducedMotion();
  const [stopped, setStopped] = useState(false);
  const [held, setHeld] = useState({ hover: false, focus: false });
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const next = useRef(advance);
  useEffect(() => {
    next.current = advance;
  });

  const available = !reduced && count > 1;
  const rotating = available && !stopped && !held.hover && !held.focus && inView && tabVisible;

  useEffect(() => {
    const el = region.current;
    if (!available || !el) return;
    const hover = (on: boolean) => (): void => setHeld((h) => ({ ...h, hover: on }));
    const enter = hover(true);
    const leave = hover(false);
    const focusIn = (): void => setHeld((h) => ({ ...h, focus: true }));
    const focusOut = (e: FocusEvent): void => {
      if (!el.contains(e.relatedTarget as Node | null)) setHeld((h) => ({ ...h, focus: false }));
    };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("focusin", focusIn);
    el.addEventListener("focusout", focusOut);

    const onVisibility = (): void => setTabVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);

    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.5 });
      observer.observe(el);
    }

    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("focusin", focusIn);
      el.removeEventListener("focusout", focusOut);
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  }, [available, region]);

  useEffect(() => {
    const el = track.current;
    if (!available || !el) return;
    const takeOver = (): void => setStopped(true);
    const events = ["pointerdown", "wheel", "touchstart"] as const;
    for (const name of events) el.addEventListener(name, takeOver, { passive: true });
    return () => {
      for (const name of events) el.removeEventListener(name, takeOver);
    };
  }, [available, track]);

  useEffect(() => {
    if (!rotating) return;
    const timer = setTimeout(() => next.current(), ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [rotating, at]);

  return {
    available,
    playing: available && !stopped,
    rotating,
    toggle: () => setStopped((s) => !s),
    stop: () => setStopped(true),
  };
}
