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
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          {emoji && (
            <span
              aria-hidden
              className="grid h-12 w-12 place-items-center rounded-xl bg-muted/60 text-2xl ring-1 ring-foreground/10"
            >
              {emoji}
            </span>
          )}
          <div className="space-y-1">
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
