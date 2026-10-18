"use client";

import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mono, Text } from "@/components/ui/typography";
import { formatCurrency, moneySign } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { ChartPoint } from "@/lib/finance/chart-series";
import { periodIndexForDate } from "@/lib/finance/period";

/**
 * "How would things look then?" — the projected balance sheet for a period the
 * user clicked on the chart, against today's, with the delta between them.
 *
 * Hovering a point already previews that period's cash-flow figures in the
 * sidebar; this is the committed view, so it shows the *balances* (what you'd
 * own and owe) rather than repeating the monthly in/out.
 *
 * Laid out as one block per metric rather than a four-column table: three
 * numeric columns crammed against the right edge made the "today" reference
 * unreadable and gave the headline figure no room. Each block now leads with
 * the projected value, with the from-value and the delta as a second tier.
 *
 * Both sides are CHART POINTS, so the dialog shows exactly what the reader
 * clicked: today's day-aware position (not the period's projected close) and,
 * for a past period, the recorded figures on the solid line.
 */
type Row = {
  label: string;
  /** How to read a rise: net worth up is good, debt up is not. */
  polarity: "more-is-better" | "less-is-better";
  read: (p: ChartPoint) => number | undefined;
};

const ROWS: Row[] = [
  { label: "Net worth", polarity: "more-is-better", read: (p) => p.netWorth },
  { label: "Savings", polarity: "more-is-better", read: (p) => p.savings },
  { label: "Investments", polarity: "more-is-better", read: (p) => p.investments },
  { label: "Total debt", polarity: "less-is-better", read: (p) => p.totalDebt },
];

const BETTER = "text-success";
const WORSE = "text-destructive";

export function PeriodCompareDialog({
  open,
  onOpenChange,
  anchorDay,
  todayLabel,
  todayPoint: todayMonth,
  targetLabel,
  targetPoint: targetMonth,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The plan's anchor day — distances are counted in its periods. */
  anchorDay: number;
  todayLabel: string;
  todayPoint: ChartPoint | null;
  targetLabel: string;
  targetPoint: ChartPoint | null;
}) {
  // Counted between the two points' dates. (It used to subtract row offsets
  // from two different projections, and called a period 2 back "in 6".)
  const monthsApart =
    todayMonth && targetMonth
      ? periodIndexForDate(todayMonth.date, anchorDay, targetMonth.date)
      : 0;
  const distance = Math.abs(monthsApart);
  const periodWord = distance === 1 ? "period" : "periods";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-muted-foreground">{todayLabel}</span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{targetLabel}</span>
          </DialogTitle>
          <DialogDescription>
            {todayMonth && targetMonth
              ? monthsApart < 0
                ? `Where the plan had you ${distance} ${periodWord} ago, against today.`
                : `Where the plan puts you in ${distance} ${periodWord}, against today.`
              : "No projection for this period."}
          </DialogDescription>
        </DialogHeader>

        {todayMonth && targetMonth && (
          <div className="grid gap-2">
            {ROWS.map((row) => {
              const nowValue = row.read(todayMonth);
              const thenValue = row.read(targetMonth);
              if (nowValue === undefined || thenValue === undefined) return null;
              const now = nowValue;
              const then = thenValue;
              const delta = then - now;
              const flat = moneySign(delta) === 0;
              const better =
                row.polarity === "more-is-better" ? delta > 0 : delta < 0;
              // Direction is carried by an icon as well as colour — a delta
              // that only reads as "green" is invisible to a chunk of readers.
              const Icon = flat ? Minus : delta > 0 ? TrendingUp : TrendingDown;
              const tone = flat
                ? "text-muted-foreground"
                : better
                  ? BETTER
                  : WORSE;

              return (
                <div
                  key={row.label}
                  className="rounded-lg border bg-muted/20 px-3 py-2.5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <Text variant="small">{row.label}</Text>
                    <Mono className="text-base font-semibold tabular-nums sm:text-lg">
                      {formatCurrency(then)}
                    </Mono>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-3">
                    <Text variant="small">
                      from{" "}
                      <Mono className="tabular-nums">{formatCurrency(now)}</Mono>
                    </Text>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 text-xs",
                        tone
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                      <Mono className="tabular-nums">
                        {flat
                          ? "no change"
                          : `${delta > 0 ? "+" : "−"}${formatCurrency(Math.abs(delta))}`}
                      </Mono>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
