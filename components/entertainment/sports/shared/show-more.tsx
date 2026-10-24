"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Rows a table shows before "Show more": every table in the hub, the same. */
export const ROWS_SHOWN = 10;

/**
 * The first `ROWS_SHOWN` of `rows`, and ten more a tap. Back to ten when
 * `resetKey` changes (another conference, another tour), and on "Show fewer".
 * A key rather than `rows` itself: callers filter and sort inline, so the
 * array is new on every render.
 */
export function useShownRows<T>(
  rows: readonly T[],
  resetKey = ""
): { shown: readonly T[]; more: number; total: number; showMore: () => void; showFewer: () => void } {
  const [limit, setLimit] = useState(ROWS_SHOWN);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setLimit(ROWS_SHOWN);
  }
  return {
    shown: rows.slice(0, limit),
    more: Math.max(0, rows.length - limit),
    total: rows.length,
    showMore: () => setLimit(limit + ROWS_SHOWN),
    showFewer: () => setLimit(ROWS_SHOWN),
  };
}

/**
 * The button under a table cut at ten: "Show 10 more" (or as many as are
 * left), then "Show fewer" once every row is in. One button that changes its
 * words, so the focus stays on it. Nothing for a table of ten or fewer.
 */
export function ShowMoreRows({
  rows,
  className,
}: {
  rows: ReturnType<typeof useShownRows>;
  className?: string;
}): React.ReactElement | null {
  if (rows.total <= ROWS_SHOWN) return null;
  const next = Math.min(rows.more, ROWS_SHOWN);
  return (
    <div className={cn("flex justify-center", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={rows.more > 0 ? rows.showMore : rows.showFewer}
      >
        {rows.more > 0 ? (
          <>
            <ChevronDown data-icon="inline-start" />
            Show {next} more
          </>
        ) : (
          <>
            <ChevronUp data-icon="inline-start" />
            Show fewer
          </>
        )}
      </Button>
    </div>
  );
}
