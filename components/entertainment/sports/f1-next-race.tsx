import type { JSX } from "react";

import { Mono, Text } from "@/components/ui/typography";
import { SESSION_LABEL } from "@/lib/sports/f1-weekend";
import type { F1DashboardHighlight, F1Race } from "@/types/sports";

import { F1CircuitOutline } from "./f1-circuit-outline";
import { SprintBadge } from "./f1-race-labels";
import { FeatureBox } from "./shared/feature-box";
import type { MatchTimeFormat } from "./shared/match-time";
import { StatusPill } from "./shared/status-pill";

/**
 * The race the dashboard's F1 card leads with, in the frame of the football
 * card's featured match so the two read as a pair side by side: the circuit,
 * where and when, what runs next, and last year's winner there.
 *
 * Everything time-dependent arrives worked out in `highlight` for this
 * request, so it renders on the server only.
 */
export function F1NextRace({
  highlight,
  format,
  href,
}: {
  highlight: F1DashboardHighlight;
  format: MatchTimeFormat;
  href: string;
}): JSX.Element {
  const { race, liveSession, nextSession, nextSessionIn } = highlight;
  const winner = race.winner?.code ?? race.podium?.[0];
  // The race's own session is the status on top; any other is a line below,
  // so the race time stays in view all weekend.
  const sessionLive = liveSession && liveSession.kind !== "race" ? liveSession : undefined;
  return (
    <FeatureBox
      href={href}
      label={`Round ${race.round}`}
      status={<RaceStatus race={race} raceLive={liveSession?.kind === "race"} format={format} />}
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <span aria-hidden className="leading-none">
              {race.flagEmoji}
            </span>
            <span className="truncate font-semibold">{race.name}</span>
            {race.sprint && <SprintBadge />}
          </span>
          <Text variant="small" as="span" className="truncate">
            {race.country ? `${race.circuit} · ${race.country}` : race.circuit}
          </Text>
          {sessionLive && (
            <StatusPill status="live" label={`${SESSION_LABEL[sessionLive.kind]} live`} />
          )}
          {/* Relative first: on a phone the line truncates, and "in 6d" says
              more than the end of a date. */}
          {nextSession && (
            <Mono className="truncate text-2xs text-muted-foreground">
              {SESSION_LABEL[nextSession.kind]}
              {nextSessionIn && ` ${nextSessionIn}`} · {format.dayTime(nextSession.startsAt)}
            </Mono>
          )}
          {race.status === "completed" && winner && (
            <span className="flex min-w-0 items-baseline gap-1.5 text-xs">
              <span className="font-semibold">Winner {winner}</span>
              {race.winner?.team && <span className="truncate text-muted-foreground">{race.winner.team}</span>}
              {race.pole && <Mono className="shrink-0 text-2xs text-muted-foreground">Pole {race.pole.code}</Mono>}
            </span>
          )}
          {race.lastYear && (
            <span className="truncate text-2xs text-muted-foreground">
              {race.lastYear.season} winner · {race.lastYear.name} ({race.lastYear.team})
            </span>
          )}
        </div>
        {/* As tall as the lines beside it: at 56px a wide track like Austin
            drew a sliver, too small to be the block's picture. */}
        <F1CircuitOutline circuitId={race.circuitId} className="size-20 shrink-0 text-foreground/80" />
      </div>
    </FeatureBox>
  );
}

/** Right of the round, as football writes a kickoff: the start, live, or the final. */
function RaceStatus({
  race,
  raceLive,
  format,
}: {
  race: F1Race;
  raceLive: boolean;
  format: MatchTimeFormat;
}): JSX.Element {
  if (raceLive || race.status === "live") return <StatusPill status="live" />;
  return (
    <Mono className="shrink-0 text-2xs text-muted-foreground">
      {race.status === "completed"
        ? `Final · ${format.shortDay(race.startsAt ?? race.date)}`
        : race.startsAt
          ? `${format.shortDay(race.startsAt)} · ${format.time(race.startsAt)}`
          : format.shortDay(race.date)}
    </Mono>
  );
}
