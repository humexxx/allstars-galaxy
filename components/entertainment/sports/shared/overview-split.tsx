"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { Eyebrow } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { scrollParent, scrollportHeight } from "./scroll";

type OverviewSplitProps = {
  /** The day-by-day list (`MatchesByDate`). */
  matches: ReactNode;
  /** The table beside it. Without one the matches fill the row. */
  table?: ReactNode;
  /** The table's eyebrow: "Table", "Standings". */
  tableLabel?: string;
};

/**
 * An Overview tab's two columns (football, the NBA, the NFL): every match on
 * the left and the table beside them from `@4xl`, stacked below that.
 *
 * The table opens on a label set like a day heading, so its card starts level
 * with the first match card and the two columns read as one layout.
 *
 * Beside the matches the table rides along with the page, just under the
 * sport bar, its label on the line of the stuck day heading. One taller than
 * the room left there (football's full twenty) would hide its last rows for
 * good stuck by its top, so it sticks by its foot instead: it scrolls with the
 * page until its last row is in view, then stays.
 */
export function OverviewSplit({
  matches,
  table,
  tableLabel = "Table",
}: OverviewSplitProps): React.ReactElement {
  const tableRef = useRef<HTMLElement>(null);
  const tall = useTallerThanRoom(tableRef, Boolean(table));
  return (
    <div className={cn("grid items-start gap-6", table && "@4xl:grid-cols-[2fr_1fr]")}>
      {matches}
      {table ? (
        <section
          ref={tableRef}
          className={cn(
            "flex min-w-0 flex-col gap-2 @4xl:sticky",
            tall ? "@4xl:bottom-6 @4xl:self-end" : "@4xl:top-12"
          )}
        >
          {/* The size, padding and gap of a day heading in MatchesByDate. */}
          <Eyebrow size="sm" as="div" className="py-1">
            {tableLabel}
          </Eyebrow>
          {table}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Whether a sticky element is taller than the scrollport leaves below its
 * `top`. Below `@4xl` the table is not sticky, so never.
 */
function useTallerThanRoom(ref: RefObject<HTMLElement | null>, mounted: boolean): boolean {
  const [tall, setTall] = useState(false);
  // Stuck by its foot the element's `top` is `auto`; the room is still
  // measured from where its top would stick.
  const top = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      const style = getComputedStyle(el);
      if (style.position !== "sticky") {
        setTall(false);
        return;
      }
      const stuckAt = Number.parseFloat(style.top);
      if (Number.isFinite(stuckAt)) top.current = stuckAt;
      setTall(el.offsetHeight > scrollportHeight(el) - top.current);
    };
    measure();
    const scroller = scrollParent(el);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (scroller) observer.observe(scroller);
    else window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, mounted]);

  return tall;
}
