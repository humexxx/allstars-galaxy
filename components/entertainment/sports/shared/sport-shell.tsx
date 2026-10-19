"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Heading, Text } from "@/components/ui/typography";

type SportShellProps = {
  /** Big emoji or logo shown at the top-left next to the title. */
  emoji?: string;
  title: string;
  subtitle?: string;
  /** Optional pill controls (league/conference/region selector). */
  controls?: ReactNode;
  /** Tab strip rendered below the header. */
  tabs?: ReactNode;
  /** Right-aligned tabs/sub-navigation. */
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Generic header + body wrapper used by every sport view. Matches the visual
 * rhythm of Google's sports panels (logo · title · tab strip) but built on the
 * project's shadcn primitives.
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
}: SportShellProps) {
  return (
    // The header goes side by side only once the column can hold both: with
    // the sidebar open, a viewport `sm:` put a 224px league picker beside the
    // title and wrapped "UEFA Champions League" onto three lines.
    <div className={cn("@container flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-4 @2xl:flex-row @2xl:items-end @2xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {emoji && (
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted/60 text-2xl ring-1 ring-foreground/10"
            >
              {emoji}
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <Heading level="h3" as="h2">
              {title}
            </Heading>
            {subtitle && <Text variant="muted">{subtitle}</Text>}
          </div>
        </div>
        {(controls || rightSlot) && (
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            {rightSlot}
          </div>
        )}
      </div>
      {tabs && <div>{tabs}</div>}
      <div>{children}</div>
    </div>
  );
}
