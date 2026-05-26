"use client";

import { useEffect, useState } from "react";

import { formatCurrency } from "@/lib/utils/format";

type FinancialHealthDonutProps = {
  /** Fixed monthly obligations: living expenses + scheduled debt payments. */
  obligations: number;
  /** Gross monthly income. */
  income: number;
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
    return { label: "Healthy", tone: "positive", stroke: "#16a34a" };
  if (ratio < YELLOW_THRESHOLD)
    return { label: "Caution", tone: "warning", stroke: "#f59e0b" };
  return { label: "Stretched", tone: "negative", stroke: "#dc2626" };
}

const TONE_TEXT: Record<Status["tone"], string> = {
  positive: "text-green-600",
  warning: "text-amber-600",
  negative: "text-red-600",
  muted: "text-muted-foreground",
};

export function FinancialHealthDonut({
  obligations,
  income,
}: FinancialHealthDonutProps) {
  const hasIncome = Number.isFinite(income) && income > 0;
  const targetRatio = hasIncome ? Math.max(0, obligations) / income : 0;
  const status = statusFor(targetRatio, hasIncome);

  // Animated ratio for the ring fill + percentage label. Same easeOutQuint
  // we use everywhere else so the page feels unified on first paint.
  const [displayedRatio, setDisplayedRatio] = useState(0);
  useEffect(() => {
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
  }, [targetRatio]);

  const displayedPercent = hasIncome
    ? `${Math.round(displayedRatio * 100)}%`
    : "—";

  // Geometry: a full circle. We use SVG stroke-dasharray to fill the ring
  // proportionally to the displayed ratio.
  const size = 110;
  const cx = size / 2;
  const cy = size / 2;
  const r = 44;
  const stroke = 12;
  const circumference = 2 * Math.PI * r;
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
          aria-label={`${status.label}, ${displayedPercent} obligations to income`}
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
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono text-2xl font-bold leading-none tabular-nums ${TONE_TEXT[status.tone]}`}
          >
            {displayedPercent}
          </span>
          <span className={`text-[10px] font-medium ${TONE_TEXT[status.tone]}`}>
            {status.label}
          </span>
        </div>
      </div>
      {hasIncome && (
        <div className="text-[11px] text-muted-foreground">
          {formatCurrency(obligations)} of {formatCurrency(income)}
        </div>
      )}
    </div>
  );
}
