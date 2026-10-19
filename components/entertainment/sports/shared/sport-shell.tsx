"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
  /** Tab strip: the sticky row, beside the name from `@4xl`. */
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
 * The tabs ride along with the page, in a sticky bar under the app header.
 * From `@4xl` the whole header is that bar, one row: tile, name, tabs, then
 * the controls on the right. Narrower, the name and controls take a row of
 * their own that scrolls away, and only the tabs stick.
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
  const barRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasTabs = Boolean(tabs);

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
      const bar =
        [barRef.current, tabsRow].find(
          (el): el is HTMLDivElement => !!el && getComputedStyle(el).position === "sticky"
        ) ?? tabsRow;
      const hidden = bar.getBoundingClientRect().bottom - content.getBoundingClientRect().top;
      if (hidden > 0) scrollByFrom(content, -hidden);
    });
    observer.observe(tabsRow, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
    return () => observer.disconnect();
  }, [hasTabs]);

  return (
    // The root is what the sticky pieces stick inside, so they stay up for
    // the whole panel. Both are its own children even when the tabs sit in
    // the name's row: the bar is `display: contents` until `@4xl`, and an
    // element sticks only within its parent's box.
    //
    // The source runs name, tabs, controls, the order of the `@4xl` row, so
    // the keyboard reaches the tabs before the picker on their right. Below
    // it the root wraps, and `order` lifts the name and then the controls
    // onto the line above the tabs.
    <div className={cn("@container flex flex-wrap items-center gap-x-4", className)}>
      <div
        ref={barRef}
        className="contents @4xl:sticky @4xl:top-0 @4xl:z-20 @4xl:flex @4xl:h-12 @4xl:basis-full @4xl:items-center @4xl:gap-6 @4xl:border-b @4xl:bg-background"
      >
        <div className="order-first flex min-w-0 basis-full items-center gap-3 pb-4 @2xl:flex-1 @4xl:order-none @4xl:flex-initial @4xl:gap-2 @4xl:pb-0">
          {emoji && (
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted/60 text-2xl ring-1 ring-foreground/10 @4xl:size-8 @4xl:rounded-lg @4xl:text-lg"
            >
              {emoji}
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1 @4xl:gap-0">
            <Heading level="h3" as="h1" className="@4xl:truncate @4xl:text-base">
              {title}
            </Heading>
            {subtitle && (
              <Text variant="muted" className="@4xl:truncate @4xl:text-xs">
                {subtitle}
              </Text>
            )}
          </div>
        </div>
        {tabs && (
          <div
            ref={tabsRef}
            className="sticky top-14 z-20 flex h-12 min-w-0 basis-full items-end border-b bg-background md:top-0 @4xl:static @4xl:h-auto @4xl:shrink-0 @4xl:basis-auto @4xl:self-stretch @4xl:border-0 @4xl:bg-transparent"
          >
            {/* Scrolls sideways when the tabs outrun a phone (LoL's four
                during Worlds). Bottom-aligned, and let down over the border
                with room under the list, so a line tab's underline still
                lands on the border instead of being clipped by the scroller. */}
            <div
              ref={scrollerRef}
              className="-mb-0.5 flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-0.5"
            >
              {tabs}
            </div>
          </div>
        )}
        {(controls || rightSlot) && (
          <div className="-order-1 flex basis-full flex-wrap items-center gap-2 pb-4 @2xl:basis-auto @4xl:order-none @4xl:ml-auto @4xl:shrink-0 @4xl:flex-nowrap @4xl:pb-0">
            {controls}
            {rightSlot}
          </div>
        )}
      </div>
      <div ref={contentRef} className="min-w-0 basis-full pt-6">
        {children}
      </div>
    </div>
  );
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
