import { Eyebrow, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { DashboardBracket as DashboardBracketData, DashboardSide } from "@/types/sports";

import { TeamBadge } from "./shared/team-badge";

/**
 * An event's knockouts on its dashboard card, where another sport has its
 * table: a column a round, each tie its two sides by code with the score, the
 * ties of a round spread down the column so each sits between the two that
 * fed it. Codes, not names: three columns share a phone's width.
 */
export function DashboardBracket({ bracket }: { bracket: DashboardBracketData }): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow size="sm" asChild>
        <h3>{bracket.label}</h3>
      </Eyebrow>
      <ol
        role="list"
        aria-label={bracket.label}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${bracket.rounds.length}, minmax(0, 1fr))` }}
      >
        {bracket.rounds.map((round) => (
          <li key={round.label} className="flex min-w-0 flex-col gap-1">
            <Mono className="truncate text-2xs text-muted-foreground">{round.label}</Mono>
            <ul role="list" aria-label={round.label} className="flex flex-1 flex-col justify-around gap-1">
              {round.ties.map((tie) => (
                <li key={tie.id} className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-1.5 py-1">
                  <BracketSide side={tie.home} decided={tie.decided} />
                  <BracketSide side={tie.away} decided={tie.decided} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BracketSide({ side, decided }: { side: DashboardSide; decided: boolean }): React.ReactElement {
  const lost = decided && !side.winner;
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", lost && "text-muted-foreground")}>
      <TeamBadge
        team={{ name: side.name, shortName: side.name, code: side.code, primaryColor: side.color, logoUrl: side.logoUrl }}
        size="sm"
        className={cn(lost && "opacity-60")}
      />
      <span className={cn("min-w-0 flex-1 truncate", side.winner && "font-semibold")} title={side.name}>
        {side.code}
      </span>
      {side.score !== null && <Mono className={cn("text-xs", side.winner && "font-semibold")}>{side.score}</Mono>}
    </span>
  );
}
