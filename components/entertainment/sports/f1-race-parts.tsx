import { Timer, Trophy } from "lucide-react";
import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Mono, Text } from "@/components/ui/typography";
import { raceSessions, SESSION_LABEL, weekendNow } from "@/lib/sports/f1-weekend";
import { cn } from "@/lib/utils";
import type { F1Driver, F1Race } from "@/types/sports";

import type { MatchTimeFormat } from "./shared/match-time";
import { Portrait } from "./shared/portrait";
import { StatusPill } from "./shared/status-pill";

// No hooks, and `format` is a function: as a client module, a server
// component passing it in would fail at render.

/**
 * The weekend's timetable in the reader's zone. With `now` (only after mount)
 * the sessions already run fade, the one on track is marked live and the next
 * one stands out.
 */
export function SessionList({
  race,
  format,
  now,
}: {
  race: F1Race;
  format: MatchTimeFormat;
  now: number | null;
}): JSX.Element {
  const state = now === null ? {} : weekendNow(race, now);
  return (
    <ol className="flex flex-col">
      {raceSessions(race).map((session) => {
        // A weekend runs each kind of session once.
        const live = state.live?.kind === session.kind;
        const next = state.next?.kind === session.kind;
        const done = now !== null && !live && Date.parse(session.startsAt) <= now;
        return (
          <li
            key={`${session.kind}-${session.startsAt}`}
            className={cn(
              "flex items-center justify-between gap-3 border-b py-2 last:border-b-0",
              done && "text-muted-foreground"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Text
                as="span"
                weight={session.kind === "race" || next ? "semibold" : "medium"}
                className={cn("truncate", done && "text-muted-foreground")}
              >
                {SESSION_LABEL[session.kind]}
              </Text>
              {live && <StatusPill status="live" />}
              {next && <Badge variant="info">Next</Badge>}
            </span>
            <Mono className="shrink-0 text-xs">{format.dayTime(session.startsAt)}</Mono>
          </li>
        );
      })}
    </ol>
  );
}

/** Winner, pole and fastest lap on one line, for a finished race's card. */
export function ResultsLine({ race }: { race: F1Race }): JSX.Element {
  const winner = race.winner?.code ?? race.podium?.[0];
  if (!winner) {
    return (
      <Text variant="small" as="span">
        Results to come
      </Text>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="flex items-center gap-1">
        <Trophy aria-hidden className="size-3.5 text-warning" />
        <span className="sr-only">Winner</span>
        <Mono className="font-semibold">{winner}</Mono>
      </span>
      {race.pole && (
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground">Pole</span>
          <Mono>{race.pole.code}</Mono>
        </span>
      )}
      {race.fastestLap && (
        <span className="flex items-center gap-1">
          <Timer aria-hidden className="size-3.5 text-muted-foreground" />
          <span className="sr-only">Fastest lap</span>
          <Mono>{race.fastestLap.code}</Mono>
        </span>
      )}
    </span>
  );
}

/**
 * The top three with their gaps. Names and faces come from the standings,
 * since the race feed carries only the codes.
 */
export function Podium({ race, drivers }: { race: F1Race; drivers: F1Driver[] }): JSX.Element | null {
  if (!race.podium) return null;
  const byCode = new Map(drivers.map((d) => [d.code, d]));
  const times = [race.winner?.time, race.podiumGaps?.[0], race.podiumGaps?.[1]];
  return (
    <ol className="flex flex-col gap-1">
      {race.podium.map((code, i) => {
        const driver = byCode.get(code);
        return (
          <li key={code} className="flex items-center gap-3 rounded-md px-2 py-1.5 odd:bg-muted/40">
            <Mono className="w-4 shrink-0 text-xs text-muted-foreground">{i + 1}</Mono>
            <Portrait
              size="sm"
              subject={{
                name: driver?.shortName ?? code,
                imageUrl: driver?.imageUrl,
                flagUrl: driver?.flagUrl,
              }}
              fallback={<span className="text-base leading-none">{driver?.flagEmoji ?? "🏁"}</span>}
            />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <Text as="span" weight="medium" className="truncate">
                {driver?.shortName ?? code}
              </Text>
              <Text variant="small" as="span" className="truncate">
                {i === 0 ? (race.winner?.team ?? driver?.team) : driver?.team}
              </Text>
            </span>
            {times[i] && <Mono className="shrink-0 text-xs">{times[i]}</Mono>}
          </li>
        );
      })}
    </ol>
  );
}
