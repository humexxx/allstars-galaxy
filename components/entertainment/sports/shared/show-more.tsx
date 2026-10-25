"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Rows a table shows before "Show more": every table in the hub, the same. */
export const ROWS_SHOWN = 10;

/**
 * The first `ROWS_SHOWN` of `rows`, and ten more a tap. Back to ten when
 * `resetKey` changes (another conference, another session), and on "Show fewer".
 * A key rather than `rows` itself: callers filter and sort inline, so the
 * array is new on every render.
 *
 * `said` is what the last tap did, for a screen reader: set by a tap alone,
 * so fresh data or a reset never speaks up on its own, and cleared by a reset.
 */
export function useShownRows<T>(
  rows: readonly T[],
  resetKey = ""
): {
  shown: readonly T[];
  more: number;
  total: number;
  said: string;
  showMore: () => void;
  showFewer: () => void;
} {
  const [limit, setLimit] = useState(ROWS_SHOWN);
  const [said, setSaid] = useState("");
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setLimit(ROWS_SHOWN);
    setSaid("");
  }
  const total = rows.length;
  return {
    shown: rows.slice(0, limit),
    more: Math.max(0, total - limit),
    total,
    said,
    showMore: () => {
      const next = limit + ROWS_SHOWN;
      setLimit(next);
      setSaid(next >= total ? `Showing all ${total}` : `Showing ${next} of ${total}`);
    },
    showFewer: () => {
      setLimit(ROWS_SHOWN);
      setSaid(`Showing ${ROWS_SHOWN} of ${total}`);
    },
  };
}

/**
 * The button under a table cut at ten: "Show 10 more" (or as many as are
 * left), then "Show fewer" once every row is in. One button that changes its
 * words, so the focus stays on it, and a quiet count beside it for a screen
 * reader, which the button's unchanged name would otherwise leave silent.
 * Nothing for a table of ten or fewer.
 */
export function ShowMoreRows({
  rows,
  className,
}: {
  rows: ReturnType<typeof useShownRows>;
  className?: string;
}): React.ReactElement | null {
  const button = useRef<HTMLButtonElement>(null);

  // The rows go in above the button and push it down, off a short screen,
  // where a keyboard's next press would land unseen. Only for the keyboard:
  // a click that focused it leaves the page where the reader put it.
  useLayoutEffect(() => {
    const el = button.current;
    if (el && document.activeElement === el && el.matches(":focus-visible")) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [rows.shown.length]);

  if (rows.total <= ROWS_SHOWN) return null;
  const next = Math.min(rows.more, ROWS_SHOWN);
  return (
    <div className={cn("flex justify-center", className)}>
      <Button
        ref={button}
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
      <span role="status" className="sr-only">
        {rows.said}
      </span>
    </div>
  );
}
