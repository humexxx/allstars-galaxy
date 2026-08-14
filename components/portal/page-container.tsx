import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The single source of truth for portal page padding and width.
 *
 * Each route renders its own container and declares the width it needs. This
 * used to live in `app/portal/layout.tsx` and sniff `usePathname()` to widen
 * `/portal/plans` — which meant the shared shell carried a hardcoded list of
 * special routes, and the whole container had to be a client component just to
 * read the path. Declaring it at the route removes both problems.
 *
 * Add the container in a segment `layout.tsx` when several routes under it
 * share a width (see `app/portal/plans/layout.tsx`), otherwise in the page.
 */
export type PortalPageWidth = "default" | "wide" | "full";

const MAX_WIDTH: Record<PortalPageWidth, string> = {
  /** Reading width for text- and form-heavy pages. */
  default: "max-w-5xl",
  /** Data surfaces that need the room — the finance plans chart + rail. */
  wide: "max-w-7xl",
  /** Edge to edge; the route handles its own bounds. */
  full: "max-w-none",
};

type PortalPageContainerProps = {
  children: ReactNode;
  width?: PortalPageWidth;
  className?: string;
};

export function PortalPageContainer({
  children,
  width = "default",
  className,
}: PortalPageContainerProps) {
  return (
    <div
      className={cn(
        // Mobile-first: the base step is the phone value, sm+ pins the desktop
        // gutters. 24px side gutters ate 13% of a 375px screen — 16px gives
        // dense finance tables and card rails the room back.
        "mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-12",
        MAX_WIDTH[width],
        className
      )}
    >
      {children}
    </div>
  );
}
