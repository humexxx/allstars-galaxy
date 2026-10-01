"use client";

import { Circle } from "lucide-react";

import { Eyebrow, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { Match, Team } from "@/types/sports";

import { TeamBadge } from "./team-badge";
import { useMatchTime } from "./time-zone-context";

type ScoreCardProps = {
  match: Match;
  teams: Map<string, Team>;
  /**
   * Leave the stage label off — for a list already grouped under that very
   * label, where printing it again on every card is the same line twice.
   */
  hideStage?: boolean;
  className?: string;
};

/** The status code, or null for a fixture (which shows its date instead). */
function formatStatus(match: Match): string | null {
  switch (match.status) {
    case "ft":
      return "FT";
    case "aet":
      return "AET";
    case "pen":
      return "PEN";
    case "live":
      return match.minute ? `${match.minute}'` : "Live";
    case "scheduled":
      return null;
    case "postponed":
      return "PPD";
    case "cancelled":
      return "CAN";
  }
}

export function ScoreCard({ match, teams, hideStage = false, className }: ScoreCardProps) {
  const format = useMatchTime();
  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  if (!home || !away) return null;

  const homeWon =
    match.homeScore !== null &&
    match.awayScore !== null &&
    match.homeScore > match.awayScore;
  const awayWon =
    match.homeScore !== null &&
    match.awayScore !== null &&
    match.awayScore > match.homeScore;
  const isLive = match.status === "live";
  const scheduled = match.status === "scheduled";
  const status = formatStatus(match);

  return (
    <div
      className={cn(
        "relative grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {match.stageLabel && !hideStage && (
          <Eyebrow size="sm" className="truncate">
            {match.stageLabel}
          </Eyebrow>
        )}
        <TeamRow
          team={home}
          score={match.homeScore}
          isWinner={homeWon}
          redCard={match.homeRedCard}
          dim={awayWon && !isLive}
          scheduled={scheduled}
        />
        <TeamRow
          team={away}
          score={match.awayScore}
          isWinner={awayWon}
          redCard={match.awayRedCard}
          dim={homeWon && !isLive}
          scheduled={scheduled}
        />
      </div>
      {/* Status code over the day for a result, the day over the kickoff
          time for a fixture — one shape, so a list of cards reads down one
          column. A fixed width keeps the divider in the same place on every
          card of a list. */}
      <div className="flex min-w-16 flex-col items-end justify-center gap-0.5 border-l pl-3 text-right">
        {status !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground",
              isLive && "text-success",
            )}
          >
            {isLive && <Circle className="size-2 fill-current motion-safe:animate-pulse" aria-hidden />}
            {status}
          </span>
        )}
        {!isLive && (
          <Mono className="text-2xs text-muted-foreground">{format.shortDay(match.kickoff)}</Mono>
        )}
        {scheduled && (
          <Mono className="text-2xs text-muted-foreground">{format.time(match.kickoff)}</Mono>
        )}
      </div>
    </div>
  );
}

function TeamRow({
  team,
  score,
  isWinner,
  redCard,
  dim,
  scheduled,
}: {
  team: Team;
  score: number | null;
  isWinner: boolean;
  redCard?: boolean;
  dim?: boolean;
  scheduled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 text-sm",
        dim && "text-muted-foreground",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <TeamBadge team={team} size="sm" />
        <span className={cn("min-w-0 truncate", isWinner && "font-semibold")}>
          {team.shortName}
        </span>
        {redCard && (
          <span role="img" className="h-3 w-2 rounded-xs bg-destructive" aria-label="Red card" />
        )}
      </div>
      {!scheduled && score !== null && (
        <Mono
          className={cn(
            "shrink-0 text-sm tabular-nums",
            isWinner ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {score}
        </Mono>
      )}
    </div>
  );
}
