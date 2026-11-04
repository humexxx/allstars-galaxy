import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The single source of truth for portal page padding and width.
 *
 * Every portal page shares one width, `max-w-7xl` — the room the finance plans
 * chart + rail were laid out in. Routes used to choose between that and a
 * `max-w-5xl` reading width, so the column jumped every time the reader moved
 * between modules. Pages that want a narrower measure (a form, a long text)
 * constrain that block inside the container, not the page.
 *
 * Each route renders its own container. This used to live in
 * `app/portal/layout.tsx` and sniff `usePathname()` to widen `/portal/plans`,
 * which made the whole shell a client component just to read the path. Add it
 * in a segment `layout.tsx` when several routes under it share it (see
 * `app/portal/plans/layout.tsx`), otherwise in the page.
 */
type PortalPageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PortalPageContainer({
  children,
  className,
}: PortalPageContainerProps) {
  return (
    <div
      className={cn(
        // Mobile-first: the base step is the phone value, sm+ pins the desktop
        // gutters. 24px side gutters ate 13% of a 375px screen — 16px gives
        // dense finance tables and card rails the room back.
        "mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-12",
        className
      )}
    >
      {children}
    </div>
  );
}
