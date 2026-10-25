import type { ReactNode } from "react";
import { Trophy, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** One fact about an event: its icon stands in for the label, which a screen reader still hears. */
export type Fact = { label: string; icon: LucideIcon; iconClassName?: string; value: ReactNode };

/** An event's facts (a tournament's, a surf stop's), one a line behind its icon. */
export function FactList({ facts }: { facts: Fact[] }): React.ReactElement {
  return (
    <dl className="flex flex-col gap-2">
      {facts.map(({ label, icon: Icon, iconClassName, value }) => (
        <div key={label} className="flex items-start gap-2 text-sm">
          <dt className="flex h-6 shrink-0 items-center text-muted-foreground">
            <Icon aria-hidden className={cn("size-4", iconClassName)} />
            <span className="sr-only">{label}</span>
          </dt>
          <dd className="min-w-0 leading-6">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Sinner d. Alcaraz": the winner, and the beaten finalist where there is one. */
export function VersusLine({ winner, runnerUp }: { winner: string; runnerUp?: string }): React.ReactElement {
  return (
    <>
      <span className="font-medium">{winner}</span>
      {runnerUp && (
        <span className="text-muted-foreground">
          {" "}
          <span aria-hidden>d.</span>
          <span className="sr-only">defeated</span> {runnerUp}
        </span>
      )}
    </>
  );
}

/** A tile's foot once somebody has won: the trophy, and who, `label` read first. */
export function TileWinner({ label, children }: { label: string; children: ReactNode }): React.ReactElement {
  return (
    <span className="flex items-start gap-2 border-t pt-2 text-xs">
      <Trophy aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <span className="min-w-0">
        <span className="sr-only">{label}: </span>
        {children}
      </span>
    </span>
  );
}
