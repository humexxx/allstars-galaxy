"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { useReaderTimeZone } from "@/components/reader-time-zone";
import { useNow } from "@/components/entertainment/sports/use-now";
import { refreshPricesAction } from "@/app/actions/price-refresh";
import { runAction } from "@/lib/actions/run";
import {
  formatAgo,
  formatSpan,
  isQuoteOverdue,
  nextRunAfter,
} from "@/lib/finance/price-freshness";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/date";
import type { PriceFreshnessData } from "@/types/portfolio";

/**
 * "Prices updated 2 h ago · next in 22 h" plus a Refresh button, for the
 * corner of the owner's margin chart. The page is only as fresh as its oldest
 * price, so that is the one the label reports; the tooltip has every asset's
 * exact time in the reader's zone.
 */
export function PriceFreshness({ quotes, schedule }: PriceFreshnessData): React.JSX.Element | null {
  const timeZone = useReaderTimeZone();
  const now = useNow();
  const [pending, startTransition] = useTransition();
  // Hover and focus open the details on their own; a tap does not, so a
  // click opens them too.
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetched = quotes.filter(
    (q): q is typeof q & { fetchedAt: string } => q.source !== "manual" && q.fetchedAt !== null
  );
  if (fetched.length === 0) return null;

  const oldest = fetched.reduce((a, b) => (a.fetchedAt <= b.fetchedAt ? a : b));
  const updatedAt = new Date(oldest.fetchedAt);
  const nextRun = schedule && now !== null ? nextRunAfter(schedule, new Date(now)) : null;
  const overdue =
    schedule !== null &&
    now !== null &&
    isQuoteOverdue(oldest.source, updatedAt, schedule, new Date(now));
  const dailyCloses = fetched.some((q) => q.source === "massive");

  const refresh = (): void => {
    startTransition(async () => {
      const result = await runAction(refreshPricesAction(), {
        failure: "Failed to refresh prices",
      });
      if (!result.ok || !result.data) return;
      const outcome = result.data;
      if (outcome.status === "current") {
        toast.info(
          outcome.newerAt
            ? `Already the latest prices. Newer ones from ${formatDateTime(outcome.newerAt, timeZone)}.`
            : "Already the latest prices."
        );
      } else if (outcome.missed > 0) {
        toast.warning(
          `Refreshed ${outcome.fetched} of ${outcome.fetched + outcome.missed} prices. The rest keep their last price.`
        );
      } else {
        toast.success("Prices refreshed");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Tooltip open={detailsOpen} onOpenChange={setDetailsOpen}>
        <TooltipTrigger asChild>
          <Text
            asChild
            variant="small"
            className={cn(
              "rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              overdue && "text-warning"
            )}
          >
            <button
              type="button"
              onClick={(e) => {
                // Radix closes a tooltip on click; keep it open for a tap.
                e.preventDefault();
                setDetailsOpen(true);
              }}
            >
              Prices updated{" "}
              <time dateTime={oldest.fetchedAt}>
                {now === null
                  ? formatDateTime(updatedAt, timeZone)
                  : formatAgo(now - updatedAt.getTime())}
              </time>
              {nextRun && now !== null && <> · next in {formatSpan(nextRun.getTime() - now)}</>}
            </button>
          </Text>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          collisionPadding={16}
          className="flex max-w-64 flex-col gap-1"
        >
          {overdue && (
            <span className="font-medium">
              The last price run didn&apos;t update these. Refresh to fetch the latest close.
            </span>
          )}
          {fetched.length === 1 ? (
            <span>Updated {formatDateTime(updatedAt, timeZone)}</span>
          ) : (
            fetched.map((q) => (
              <span key={q.symbol} className="flex justify-between gap-3">
                <span>{q.symbol}</span>
                <span>{formatDateTime(q.fetchedAt, timeZone)}</span>
              </span>
            ))
          )}
          {nextRun && <span>Next price run {formatDateTime(nextRun, timeZone)}</span>}
          {dailyCloses && (
            <span className="opacity-70">
              Massive serves the previous day&apos;s close, so prices move once a day.
            </span>
          )}
        </TooltipContent>
      </Tooltip>

      <Button
        variant="ghost"
        size="xs"
        onClick={refresh}
        disabled={pending}
        aria-busy={pending}
        className="text-muted-foreground"
      >
        <RefreshCw className={cn(pending && "motion-safe:animate-spin")} />
        {/* Icon-only on a phone, so the status and the button share a line. */}
        <span className="max-sm:sr-only">{pending ? "Refreshing…" : "Refresh"}</span>
      </Button>
    </div>
  );
}
