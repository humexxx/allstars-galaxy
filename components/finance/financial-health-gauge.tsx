"use client";

import { useEffect, useMemo, useState } from "react";

import { formatCurrency } from "@/lib/utils/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FinancialHealthGaugeProps = {
  /** Fixed monthly obligations: living expenses + scheduled debt payments. */
  obligations: number;
  /** Gross monthly income. */
  income: number;
  /** Optional breakdown — surfaced in the tooltip if provided. */
  livingExpenses?: number;
  minDebtPayments?: number;
};

// Industry-standard thresholds for the obligations-to-income ratio (think DTI
// extended to include fixed living costs). Lenders typically flag anything
// above ~36% as stretched; above 50% as a red flag.
const GREEN_THRESHOLD = 0.36;
const YELLOW_THRESHOLD = 0.5;

// Semicircle anchors in math-angle convention (0° right, 90° up, 180° left).
// We sweep from the LEFT (high obligations = stretched/red) over the top to
// the RIGHT (low obligations = healthy/green). The visual direction is
// mirrored from the math-natural one — see ratioToAngle() below for how the
// ratio maps onto the arc.
const START_ANGLE = 180;
const END_ANGLE = 0;
const SWEEP = START_ANGLE - END_ANGLE; // 180°

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  fromAngle: number,
  toAngle: number
): string {
  const start = polar(cx, cy, r, fromAngle);
  const end = polar(cx, cy, r, toAngle);
  const largeArc = Math.abs(fromAngle - toAngle) > 180 ? 1 : 0;
  // sweep-flag=1 = clockwise in SVG visual coordinates. Going from the left
  // point to the right point clockwise traces through the TOP of the circle
  // (9 o'clock → 12 o'clock → 3 o'clock), which is what we want for a gauge.
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function ratioToAngle(ratio: number): number {
  const clamped = Math.max(0, Math.min(1, ratio));
  // ratio 0 (healthy) → END_ANGLE (right, green side).
  // ratio 1 (stretched) → START_ANGLE (left, red side).
  return END_ANGLE + clamped * SWEEP;
}

// One-line explanation of each status, surfaced in the gauge tooltip so users
// understand WHY they're in that band.
const STATUS_DESCRIPTIONS: Record<string, string> = {
  Healthy: "You have room to absorb shocks and invest.",
  Caution: "Manageable, but a surprise expense would hurt.",
  Stretched: "Most income is committed to fixed costs.",
  "No income": "Add income lines to see your financial health.",
};

export function FinancialHealthGauge({
  obligations,
  income,
  livingExpenses,
  minDebtPayments,
}: FinancialHealthGaugeProps) {
  const { ratio, status, statusColor, percentLabel, hasData } = useMemo(() => {
    if (!Number.isFinite(income) || income <= 0) {
      return {
        ratio: 0,
        status: "No income",
        statusColor: "text-muted-foreground",
        percentLabel: "—",
        hasData: false,
      };
    }
    const r = Math.max(0, obligations) / income;
    const percent = `${Math.round(r * 100)}%`;
    if (r < GREEN_THRESHOLD) {
      return {
        ratio: r,
        status: "Healthy",
        statusColor: "text-green-600",
        percentLabel: percent,
        hasData: true,
      };
    }
    if (r < YELLOW_THRESHOLD) {
      return {
        ratio: r,
        status: "Caution",
        statusColor: "text-amber-600",
        percentLabel: percent,
        hasData: true,
      };
    }
    return {
      ratio: r,
      status: "Stretched",
      statusColor: "text-red-600",
      percentLabel: percent,
      hasData: true,
    };
  }, [obligations, income]);

  const formatPct = (n: number): string =>
    income > 0 ? `${Math.round((n / income) * 100)}%` : "—";

  // Layout constants. Center the arc inside a 200×115 viewBox; the gauge spans
  // from the top of the arc down to the pivot, with the stroke thick enough to
  // read as a "fat" gauge band. r is the centreline radius of the stroke, so
  // the outer rim sits at r + thickness/2 (= 85 here).
  const cx = 100;
  const cy = 100;
  const r = 72;
  const thickness = 26;

  const greenEnd = ratioToAngle(GREEN_THRESHOLD);
  const yellowEnd = ratioToAngle(YELLOW_THRESHOLD);

  // JS-driven tween — drives both the needle rotation AND the percent label
  // off the same `displayedRatio`, so the number visibly counts up while the
  // needle sweeps. State updates every animation frame (~60 fps × 900 ms ≈ 54
  // renders); plenty fast for a small SVG + label.
  const [displayedRatio, setDisplayedRatio] = useState(0);
  useEffect(() => {
    let cancelled = false;
    // Capture the current rendered ratio as the animation's starting point so
    // data changes glide from the old number, not snap back to zero. Read via
    // a functional setter on the first tick to avoid stale-closure issues
    // and keep the effect dep list clean.
    let startRatio: number | null = null;
    const startTime = performance.now();
    const duration = 900;
    // easeOutQuint — strong tail-off; visually close to the prior CSS
    // cubic-bezier(0.16, 1, 0.3, 1).
    const ease = (t: number) => 1 - Math.pow(1 - t, 5);

    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - startTime) / duration);
      setDisplayedRatio((curr) => {
        if (startRatio === null) startRatio = curr;
        return startRatio + (ratio - startRatio) * ease(t);
      });
      if (t < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [ratio]);

  const displayedAngle = ratioToAngle(displayedRatio);
  const displayedPercent = hasData
    ? `${Math.round(displayedRatio * 100)}%`
    : "—";

  // Needle geometry is fixed: drawn pointing UP from the hub (math-angle 90°).
  // We then rotate the <g> wrapper to put the tip on the live angle.
  const needleLength = r - 10;
  const needleHalfWidth = 7;
  // SVG rotate is clockwise; math-angle 90° = up = no rotation, so the offset
  // to apply for any target math-angle θ is (90 − θ) degrees.
  const needleRotation = 90 - displayedAngle;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex cursor-help flex-col items-center"
          aria-label={`Financial health: ${status}${hasData ? `, ${percentLabel} obligations to income` : ""}`}
        >
          <svg
            viewBox="0 0 200 115"
            className="h-[110px] w-[190px]"
            role="img"
          >
            {/* Track (subtle background ring) */}
            <path
              d={arcPath(cx, cy, r, START_ANGLE, END_ANGLE)}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={thickness}
              fill="none"
            />
            {/* Red zone — left side (high obligations) */}
            <path
              d={arcPath(cx, cy, r, START_ANGLE, yellowEnd)}
              stroke="#dc2626"
              strokeWidth={thickness}
              fill="none"
            />
            {/* Yellow zone — middle */}
            <path
              d={arcPath(cx, cy, r, yellowEnd, greenEnd)}
              stroke="#f59e0b"
              strokeWidth={thickness}
              fill="none"
            />
            {/* Green zone — right side (low obligations) */}
            <path
              d={arcPath(cx, cy, r, greenEnd, END_ANGLE)}
              stroke="#16a34a"
              strokeWidth={thickness}
              fill="none"
            />
            {/* Needle — only when we have real data. The polygon is drawn
                pointing up from the hub; the <g> wrapper handles the
                rotation, driven each frame by the displayedRatio tween so
                the rotation and the percent label stay in sync. */}
            {hasData && (
              <>
                <g
                  style={{
                    transform: `rotate(${needleRotation}deg)`,
                    transformOrigin: `${cx}px ${cy}px`,
                  }}
                >
                  <polygon
                    points={`${cx - needleHalfWidth},${cy} ${cx + needleHalfWidth},${cy} ${cx},${cy - needleLength}`}
                    className="fill-foreground"
                  />
                </g>
                <circle cx={cx} cy={cy} r={8} className="fill-foreground" />
                <circle cx={cx} cy={cy} r={3} className="fill-background" />
              </>
            )}
          </svg>
          <div className="-mt-2 flex flex-col items-center text-center leading-tight">
            <span className={`text-sm font-semibold ${statusColor}`}>
              {status}
              {hasData ? ` · ${displayedPercent}` : ""}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Obligations to income
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="max-w-xs p-3">
        <div className="space-y-2 text-xs">
          <div>
            <p className={`text-sm font-semibold ${statusColor}`}>
              {status}
              {hasData ? ` · ${percentLabel}` : ""}
            </p>
            <p className="text-background/80">{STATUS_DESCRIPTIONS[status]}</p>
          </div>
          {hasData &&
            typeof livingExpenses === "number" &&
            typeof minDebtPayments === "number" && (
              <ul className="space-y-1 border-t border-background/20 pt-2">
                <li className="flex items-baseline justify-between gap-4">
                  <span>Living expenses</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(livingExpenses)}{" "}
                    <span className="text-background/60">({formatPct(livingExpenses)})</span>
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-4">
                  <span>Debt minimums</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(minDebtPayments)}{" "}
                    <span className="text-background/60">({formatPct(minDebtPayments)})</span>
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-4 border-t border-background/20 pt-1 font-semibold">
                  <span>Obligations</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(obligations)}{" "}
                    <span className="font-normal text-background/60">
                      ({percentLabel})
                    </span>
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-4 text-background/70">
                  <span>of income</span>
                  <span className="font-mono tabular-nums">{formatCurrency(income)}</span>
                </li>
              </ul>
            )}
          <p className="border-t border-background/20 pt-2 text-background/60">
            <span className="text-green-500">Healthy &lt;36%</span>
            {" · "}
            <span className="text-amber-500">Caution 36–50%</span>
            {" · "}
            <span className="text-red-500">Stretched ≥50%</span>
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
