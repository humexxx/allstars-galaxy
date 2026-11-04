"use client";

import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { formatCurrency } from "@/lib/utils/format";

import { easeOut, SWEEP_MS } from "./dashboard-motion";

/**
 * A currency figure that counts up from $0 to `value` on mount, after
 * `delay` ms, on the card's easeOut. The final figure sits invisibly under it
 * and holds the width, so the row never reflows while the digits grow; under
 * reduced motion it is simply the figure.
 */
export function CountUpCurrency({
  value,
  delay = 0,
  duration = SWEEP_MS,
}: {
  value: number;
  delay?: number;
  duration?: number;
}): React.JSX.Element {
  const reducedMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let start: number | null = null;
    const tick = (now: number): void => {
      start ??= now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setShown(value * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay, duration, reducedMotion]);

  const final = formatCurrency(value);
  if (reducedMotion || shown === null) return <>{final}</>;
  return (
    <span className="relative inline-block">
      <span className="invisible">{final}</span>
      <span className="absolute inset-0" aria-hidden="true">
        {formatCurrency(shown)}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
