"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { Heading, Text } from "@/components/ui/typography";

import { scrollByFrom } from "./scroll";

type SportShellProps = {
  /** Big emoji or logo shown at the top-left next to the title. */
  emoji?: string;
  title: string;
  subtitle?: string;
  /** Optional pill controls (league/conference/region selector). */
  controls?: ReactNode;
  /** Tab strip: the sticky row under the name. */
  tabs?: ReactNode;
  /** Right-aligned tabs/sub-navigation. */
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Generic header + body wrapper used by every sport view, and the page's
 * heading: the sports hub has no `PageHeader`, so the sport or competition is
 * the `<h1>`.
 *
 * Two rows, at every width, the way a repository or a league page reads: the
 * name (with the controls on its right) scrolls away, and the tabs under it
 * stick below the app header. Once the name has gone, a compact copy of it
 * slides into the tabs row so a stuck bar still says what it is about. The
 * name and the tabs used to share one row from `@4xl`, where a two-line title
 * centred on the row and tabs sitting on its border never lined up.
 */
export function SportShell({
  emoji,
  title,
  subtitle,
  controls,
  tabs,
  rightSlot,
  children,
  className,
}: SportShellProps): React.ReactElement {
  const titleRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasTabs = Boolean(tabs);
  const titleGone = useScrolledAway(titleRef, hasTabs);

  // A new tab picked while the bar is stuck opened part-way down its panel,
  // as far down as the old one had been read. Put its top back under the bar.
  // The views own their Tabs, so the shell watches the triggers rather than
  // a value it is never given.
  useEffect(() => {
    const tabsRow = tabsRef.current;
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!tabsRow || !scroller || !content) return;
    revealSelectedTab(scroller);
    const observer = new MutationObserver((records) => {
      const picked = records.some(
        (record) => (record.target as Element).getAttribute("aria-selected") === "true"
      );
      if (!picked) return;
      revealSelectedTab(scroller);
      const hidden = tabsRow.getBoundingClientRect().bottom - content.getBoundingClientRect().top;
      if (hidden > 0) scrollByFrom(content, -hidden);
    });
    observer.observe(tabsRow, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
    return () => observer.disconnect();
  }, [hasTabs]);

  return (
    <div className={cn("@container flex flex-col", className)}>
      <div
        ref={titleRef}
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          {emoji && (
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted/60 text-xl ring-1 ring-foreground/10"
            >
              {emoji}
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <Heading level="h4" as="h1" className="truncate">
              {title}
            </Heading>
            {subtitle && (
              <Text variant="muted" className="truncate">
                {subtitle}
              </Text>
            )}
          </div>
        </div>
        {(controls || rightSlot) && (
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            {rightSlot}
          </div>
        )}
      </div>
      {tabs && (
        <div
          ref={tabsRef}
          className="sticky top-14 z-20 flex h-12 min-w-0 items-end gap-4 border-b bg-background md:top-0"
        >
          {/* The name again, small, only while the row above is out of
              sight; the h1 is still there for a screen reader. */}
          {titleGone && (
            <span
              aria-hidden
              className="flex max-w-40 min-w-0 shrink-0 items-center gap-2 self-center text-sm font-medium @xl:max-w-64"
            >
              {emoji && <span className="text-base leading-none">{emoji}</span>}
              <span className="truncate">{title}</span>
            </span>
          )}
          {/* Scrolls sideways when the tabs outrun a phone (LoL's four
              during Worlds). Bottom-aligned, and let down over the border
              with room under the list, so a line tab's underline still lands
              on the border instead of being clipped by the scroller. */}
          <div
            ref={scrollerRef}
            className="-mb-0.5 flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-0.5"
          >
            {tabs}
          </div>
        </div>
      )}
      <div ref={contentRef} className="min-w-0 pt-6">
        {children}
      </div>
    </div>
  );
}

/**
 * Whether `ref` has scrolled up out of sight under the app header (56px; on
 * a phone the document scrolls beneath it, from `md` the portal's `<main>`
 * starts below it, so the same margin serves both). Starts false, so the
 * server's render and the first client render agree.
 */
function useScrolledAway(ref: RefObject<HTMLElement | null>, active: boolean): boolean {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const observer = new IntersectionObserver(
      ([entry]) => setGone(!entry.isIntersecting && entry.boundingClientRect.top < 56),
      { rootMargin: "-56px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, active]);
  return gone;
}

/**
 * Slides the tabs row, never the page, until the selected tab is whole: a
 * view that opens on its last tab (LoL's playoffs) would otherwise start with
 * it cut off at a phone's edge. Focus scrolls a tab in by itself; a tap or a
 * default value does not.
 */
function revealSelectedTab(scroller: HTMLElement): void {
  const tab = scroller.querySelector('[role="tab"][aria-selected="true"]');
  if (!tab) return;
  const row = scroller.getBoundingClientRect();
  const { left, right } = tab.getBoundingClientRect();
  if (right > row.right) scroller.scrollLeft += right - row.right;
  else if (left < row.left) scroller.scrollLeft -= row.left - left;
}
