import Link from "next/link";
import type { JSX, ReactNode } from "react";

import { Eyebrow } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

/**
 * The boxed lead of a dashboard sport card — football's featured match, F1's
 * next race: a label and a status over whatever the sport leads with.
 *
 * One frame for both, so two cards side by side open on the same box.
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
        "flex flex-col gap-2 rounded-lg border bg-card p-2.5 transition-colors hover:bg-muted/40",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Eyebrow size="sm" as="span" className="min-w-0 truncate">
          {label}
        </Eyebrow>
        {status}
      </div>
      {children}
    </Link>
  );
}
