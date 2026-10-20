"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

let now: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function tick(): void {
  now = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    tick();
    timer = setInterval(tick, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
      now = null;
    }
  };
}

function getSnapshot(): number | null {
  return now ?? (now = Date.now());
}

function getServerSnapshot(): null {
  return null;
}

/**
 * The browser's clock, every 30 seconds — and `null` in the server's render
 * and in the hydration that has to match it.
 *
 * Anything worked out from "now" — "Qualifying in 3h" — cannot be part of the
 * server's render: the server would print one minute and the browser hydrate
 * another. During hydration this reports `null`, like the server did, and the
 * real time arrives on the next render.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
