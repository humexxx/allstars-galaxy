import { Circle } from "lucide-react";

import { Eyebrow, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatShortDay } from "@/lib/utils/date";
import type { Match, Team } from "@/types/sports";

import { TeamBadge } from "./team-badge";

type ScoreCardProps = {
  match: Match;
  teams: Map<string, Team>;
  className?: string;
};

function formatStatus(match: Match): string {
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
      return formatKickoffShort(match.kickoff);
    case "postponed":
      return "PPD";
    case "cancelled":
      return "CAN";
  }
}

// Pinned to en-US like `lib/utils/date`, so the day/month order and clock
// style do not change per visitor.
const KICKOFF_TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function formatKickoffShort(iso: string): string {
  return formatShortDay(iso);
}

function formatKickoffTime(iso: string): string {
  return KICKOFF_TIME.format(new Date(iso));
}

export function ScoreCard({ match, teams, className }: ScoreCardProps) {
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

  return (
    <div
      className={cn(
        "relative grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {match.stageLabel && (
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
      {/* Kickoffs are instants: the server renders them in UTC and the
          browser in its own zone, so the text may legitimately differ. */}
      <div className="flex flex-col items-end justify-center gap-0.5 border-l pl-3 text-right">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground",
            isLive && "text-success",
          )}
          suppressHydrationWarning
        >
          {isLive && <Circle className="size-2 fill-current motion-safe:animate-pulse" aria-hidden />}
          {formatStatus(match)}
        </span>
        {scheduled ? (
          <Mono className="text-2xs text-muted-foreground" suppressHydrationWarning>
            {formatKickoffTime(match.kickoff)}
          </Mono>
        ) : (
          !isLive && (
            <Mono className="text-2xs text-muted-foreground" suppressHydrationWarning>
              {formatKickoffShort(match.kickoff)}
            </Mono>
          )
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
