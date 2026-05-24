"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/format";

type FinancialHealthCardProps = {
  /** Fixed monthly obligations: living expenses + scheduled debt payments. */
  obligations: number;
  /** Gross monthly income. */
  income: number;
};

// Same thresholds the old gauge used — keeps the semantic mapping stable.
const GREEN_THRESHOLD = 0.36;
const YELLOW_THRESHOLD = 0.5;

type Status = {
  label: "Healthy" | "Caution" | "Stretched" | "No income";
  tone: "positive" | "warning" | "negative" | "muted";
};

function statusFor(ratio: number, hasIncome: boolean): Status {
  if (!hasIncome) return { label: "No income", tone: "muted" };
  if (ratio < GREEN_THRESHOLD) return { label: "Healthy", tone: "positive" };
  if (ratio < YELLOW_THRESHOLD) return { label: "Caution", tone: "warning" };
  return { label: "Stretched", tone: "negative" };
}

const TONE_TEXT: Record<Status["tone"], string> = {
  positive: "text-green-600",
  warning: "text-amber-600",
  negative: "text-red-600",
  muted: "text-muted-foreground",
};

const TONE_BADGE: Record<Status["tone"], string> = {
  positive: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  negative: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
  muted: "bg-muted text-muted-foreground border-muted",
};

export function FinancialHealthCard({
  obligations,
  income,
}: FinancialHealthCardProps) {
  const hasIncome = Number.isFinite(income) && income > 0;
  const targetRatio = hasIncome ? Math.max(0, obligations) / income : 0;
  const status = statusFor(targetRatio, hasIncome);

  // Count-up animation for the headline percentage. Mirrors the JS tween we
  // use on the donut so both variants feel consistent.
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

  return (
    <div className="flex min-w-[200px] flex-col items-end gap-1 rounded-lg border bg-card p-4 text-right">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Financial health
      </div>
      <div
        className={`font-mono text-4xl font-bold leading-none tabular-nums ${TONE_TEXT[status.tone]}`}
      >
        {displayedPercent}
      </div>
      <Badge
        variant="outline"
        className={`mt-1 ${TONE_BADGE[status.tone]}`}
      >
        {status.label}
      </Badge>
      {hasIncome && (
        <div className="pt-1 text-[11px] text-muted-foreground">
          {formatCurrency(obligations)} of {formatCurrency(income)} committed
        </div>
      )}
    </div>
  );
}
