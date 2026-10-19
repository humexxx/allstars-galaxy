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
  const contentRef = useRef<HTMLDivElement>(null);
  const hasTabs = Boolean(tabs);

  // A new tab picked while the bar is stuck opened part-way down its panel,
  // as far down as the old one had been read. Put its top back under the bar.
  // The views own their Tabs, so the shell watches the triggers rather than
  // a value it is never given.
  useEffect(() => {
    const tabsRow = tabsRef.current;
    const content = contentRef.current;
    if (!tabsRow || !content) return;
    const observer = new MutationObserver((records) => {
      const picked = records.some(
        (record) => (record.target as Element).getAttribute("aria-selected") === "true"
      );
      if (!picked) return;
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
    // the name's row: the wrappers between are `display: contents` until
    // `@4xl`, and an element sticks only within its parent's box.
    <div className={cn("@container flex flex-col", className)}>
      <div
        ref={barRef}
        className="contents @4xl:sticky @4xl:top-0 @4xl:z-20 @4xl:flex @4xl:h-12 @4xl:items-center @4xl:gap-6 @4xl:border-b @4xl:bg-background"
      >
        <div className="flex flex-col gap-4 pb-4 @2xl:flex-row @2xl:items-center @2xl:justify-between @4xl:contents">
          <div className="flex min-w-0 items-center gap-3 @4xl:gap-2">
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
          {(controls || rightSlot) && (
            <div className="flex flex-wrap items-center gap-2 @4xl:order-last @4xl:ml-auto @4xl:shrink-0 @4xl:flex-nowrap">
              {controls}
              {rightSlot}
            </div>
          )}
        </div>
        {/* Bottom-aligned, so a line tab's underline lands on the border. */}
        {tabs && (
          <div
            ref={tabsRef}
            className="sticky top-14 z-20 flex h-12 shrink-0 items-end border-b bg-background md:top-0 @4xl:static @4xl:h-auto @4xl:self-stretch @4xl:border-0 @4xl:bg-transparent"
          >
            {tabs}
          </div>
        )}
      </div>
      <div ref={contentRef} className="pt-6">
        {children}
      </div>
    </div>
  );
}
