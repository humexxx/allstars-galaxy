"use client";

import { useEffect, useState } from "react";

import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

type FinancialHealthDonutProps = {
  /** Fixed monthly obligations: living expenses + scheduled debt payments. */
  obligations: number;
  /** Gross monthly income. */
  income: number;
  /** Outer ring diameter in px. Defaults to 110 (the desktop gauge). Pass a
   *  smaller value for the compact mobile badge. */
  size?: number;
  /** When false, hide the "$X of $Y" caption — used in the compact variant
   *  where the same figures already live in the KPI cards. */
  showFooter?: boolean;
};

const GREEN_THRESHOLD = 0.36;
const YELLOW_THRESHOLD = 0.5;

type Status = {
  label: "Healthy" | "Caution" | "Stretched" | "No income";
  tone: "positive" | "warning" | "negative" | "muted";
  stroke: string;
};

function statusFor(ratio: number, hasIncome: boolean): Status {
  if (!hasIncome)
    return { label: "No income", tone: "muted", stroke: "currentColor" };
  if (ratio < GREEN_THRESHOLD)
    return { label: "Healthy", tone: "positive", stroke: "var(--success)" };
  if (ratio < YELLOW_THRESHOLD)
    return { label: "Caution", tone: "warning", stroke: "var(--warning)" };
  return { label: "Stretched", tone: "negative", stroke: "var(--destructive)" };
}

const TONE_TEXT: Record<Status["tone"], string> = {
  positive: "text-success",
  warning: "text-warning",
  negative: "text-destructive",
  muted: "text-muted-foreground",
};

export function FinancialHealthDonut({
  obligations,
  income,
  size = 110,
  showFooter = true,
}: FinancialHealthDonutProps) {
  const hasIncome = Number.isFinite(income) && income > 0;
  const targetRatio = hasIncome ? Math.max(0, obligations) / income : 0;
  const status = statusFor(targetRatio, hasIncome);

  // Animated ratio for the ring fill + percentage label. Same easeOutQuint
  // we use everywhere else so the page feels unified on first paint. With
  // reduced motion the ring is simply drawn at its value.
  const reducedMotion = usePrefersReducedMotion();
  const [animatedRatio, setDisplayedRatio] = useState(0);
  useEffect(() => {
    if (reducedMotion) return;
    let cancelled = false;
    let startRatio: number | null = null;
    const startTime = performance.now();
    const duration = 900;
    const ease = (t: number) => 1 - Math.pow(1 - t, 5);

    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - startTime) / duration);
      setDisplayedRatio((curr) => {
        if (startRatio === null) startRatio = curr;
        return startRatio + (targetRatio - startRatio) * ease(t);
      });
      if (t < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [targetRatio, reducedMotion]);
  const displayedRatio = reducedMotion ? targetRatio : animatedRatio;

  const displayedPercent = hasIncome
    ? `${Math.round(displayedRatio * 100)}%`
    : "—";
  // The name is built from the target, not the count-up: a screen reader
  // would otherwise announce whatever frame it happened to read.
  const targetPercent = hasIncome ? `${Math.round(targetRatio * 100)}%` : "no income";

  // Geometry: a full circle. We use SVG stroke-dasharray to fill the ring
  // proportionally to the displayed ratio. r and stroke scale off `size` so
  // the compact badge keeps the same proportions as the full gauge.
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(6, Math.round(size * 0.109));
  const r = size * 0.4;
  const circumference = 2 * Math.PI * r;
  // Steps down for 4+ digits: a plan spending 30× its income read "3063%"
  // straight across the ring.
  // Sized from the target, not the count-up, so it doesn't jump mid-animation.
  const digits = hasIncome ? String(Math.round(targetRatio * 100)).length : 1;
  const percentClass =
    size >= 100
      ? digits >= 5
        ? "text-base"
        : digits === 4
          ? "text-lg"
          : "text-2xl"
      : digits >= 4
        ? "text-sm"
        : "text-lg";
  // Clamp the displayed fill so the ring never overflows past full when the
  // ratio exceeds 1 (e.g. someone owes more than they earn).
  const filled = Math.min(1, Math.max(0, displayedRatio));
  const dashOffset = circumference * (1 - filled);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label={`${status.label}, ${targetPercent} obligations to income`}
          // Rotate so the ring fills clockwise starting from 12 o'clock.
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={stroke}
          />
          {/* Filled portion */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={status.stroke}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        >
          <span
            className={cn(
              "font-mono font-bold leading-none tabular-nums",
              percentClass,
              TONE_TEXT[status.tone]
            )}
          >
            {displayedPercent}
          </span>
          <span className={cn("text-2xs font-medium", TONE_TEXT[status.tone])}>
            {status.label}
          </span>
        </div>
      </div>
      {showFooter && hasIncome && (
        <div className="text-2xs text-muted-foreground">
          <Mono>{formatCurrency(obligations)}</Mono> of{" "}
          <Mono>{formatCurrency(income)}</Mono>
        </div>
      )}
    </div>
  );
}
