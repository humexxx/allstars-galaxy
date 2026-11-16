"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { DashboardBracket, DashboardBracketSide } from "@/types/sports";

import { TeamBadge } from "./shared/team-badge";

type Tie = DashboardBracket["rounds"][number]["ties"][number];

/**
 * One tie of a card's bracket and its tooltip: the round, the day it was
 * played and the two sides by their full names.
 *
 * A client component given data, not an `<li>` built on the server: Radix's
 * `asChild` clones its child, and a child that arrives from the server still
 * streaming is not an element yet — the trigger rendered nothing, and the
 * column came out empty in the server's HTML.
 */
export function BracketTie({ tie, when }: { tie: Tie; when: string }): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <li className="flex flex-col rounded-md bg-muted/40 px-1.5 py-0.5">
          <span className="sr-only">{when}: </span>
          <BracketSide side={tie.home} decided={tie.decided} />
          <BracketSide side={tie.away} decided={tie.decided} />
        </li>
      </TooltipTrigger>
      <TooltipContent className="flex flex-col gap-1.5 px-3 py-2">
        <span className="opacity-70">{when}</span>
        {[tie.home, tie.away].map((side, i) => (
          <span key={i} className="flex items-center justify-between gap-4">
            <span className={cn("flex items-center gap-2", side.winner ? "font-semibold" : tie.decided && "opacity-70")}>
              {side.photos && side.photos.length > 0 && (
                <span className="flex shrink-0">
                  {side.photos.map((src, n) =>
                    src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- ESPN's and the padel API's CDNs; an allowlist breaks the day either moves.
                      <img
                        key={n}
                        src={src}
                        alt=""
                        loading="lazy"
                        className={cn("size-8 rounded-full bg-background/10 object-cover object-top", n > 0 && "-ml-2")}
                      />
                    ) : (
                      // No photo published (a qualifier): the initial, so the two rows still line up.
                      <span
                        key={n}
                        aria-hidden
                        className={cn(
                          "grid size-8 place-items-center rounded-full bg-background/10 text-xs font-medium",
                          n > 0 && "-ml-2"
                        )}
                      >
                        {(side.code.split("/")[n] ?? side.code).charAt(0)}
                      </span>
                    )
                  )}
                </span>
              )}
              <span>
                {side.name}
                {side.seed && <span className="font-normal opacity-70"> ({side.seed})</span>}
              </span>
            </span>
            {side.score !== null && (
              <Mono className={cn("text-xs", side.winner && "font-semibold")}>{side.scoreLabel ?? side.score}</Mono>
            )}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

function BracketSide({ side, decided }: { side: DashboardBracketSide; decided: boolean }): React.ReactElement {
  const lost = decided && !side.winner;
  return (
    <span className={cn("flex h-5 items-center gap-1 text-2xs", lost && "text-muted-foreground")}>
      {side.photos !== undefined ? (
        // A fixed slot, seeded or not, so the names of a column line up.
        <Mono aria-hidden className="w-4 shrink-0 text-center text-2xs text-muted-foreground">
          {side.seed ?? ""}
        </Mono>
      ) : (
        <TeamBadge
          team={{ name: side.name, shortName: side.name, code: side.code, primaryColor: side.color, logoUrl: side.logoUrl }}
          size="sm"
          className={cn("size-4", lost && "opacity-60")}
        />
      )}
      <span className={cn("min-w-0 flex-1 truncate", side.winner && "font-semibold")}>
        {/* The tooltip is a pointer's; a screen reader gets the full name here. */}
        <span aria-hidden>{side.code}</span>
        <span className="sr-only">
          {side.name}
          {side.seed ? ` (seed ${side.seed})` : ""}
        </span>
      </span>
      {side.score !== null && (
        <Mono className={cn("text-2xs", side.winner && "font-semibold")}>{side.scoreLabel ?? side.score}</Mono>
      )}
    </span>
  );
}
