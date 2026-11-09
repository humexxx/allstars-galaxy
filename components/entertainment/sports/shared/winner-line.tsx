import type { ReactNode } from "react";
import { Trophy } from "lucide-react";

/**
 * Who won the race or the tournament a dashboard card leads with, the day it
 * finished and the next: the name in bold behind a trophy, the team or the
 * beaten finalist muted beside it.
 */
export function WinnerLine({
  winner,
  beside,
  extra,
}: {
  winner: string;
  beside?: string;
  extra?: ReactNode;
}): React.ReactElement {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs">
      <Trophy aria-hidden className="size-3.5 shrink-0 text-warning" />
      <span className="shrink-0 font-semibold">Winner {winner}</span>
      {beside && <span className="truncate text-muted-foreground">{beside}</span>}
      {extra}
    </span>
  );
}
