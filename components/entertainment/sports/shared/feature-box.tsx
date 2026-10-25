import Link from "next/link";
import type { JSX, ReactNode } from "react";

import { Eyebrow } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

/**
 * The boxed lead of a dashboard sport card — football's featured match, F1's
 * next race: a label and a status over whatever the sport leads with.
 *
 * One frame for every sport, at least as tall as F1's (the fullest lead), so
 * the box is one size on any card; beside another card it also stretches to
 * the row it shares (`dashboard-card-rows.ts`). What a sport leads with sits
 * centred in whatever room the label leaves.
 */
export function FeatureBox({
  href,
  label,
  status,
  children,
  className,
}: {
  href: string;
  label: ReactNode;
  /** Right of the label: a live pill, the kickoff, the final. */
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        // The focus ring inside the border: a carousel's track clips anything drawn outside it.
        "flex h-full min-h-28 flex-col gap-2 rounded-lg border bg-card p-2.5 transition-colors focus-visible:outline-hidden hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Eyebrow size="sm" as="span" className="min-w-0 truncate">
          {label}
        </Eyebrow>
        {status}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2">{children}</div>
    </Link>
  );
}
