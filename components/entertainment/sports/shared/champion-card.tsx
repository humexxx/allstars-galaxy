"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Trophy } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Eyebrow, Heading, Text } from "@/components/ui/typography";
import type { BracketMatch, Team } from "@/types/sports";

import { burstConfetti } from "./confetti";
import { TeamBadge } from "./team-badge";
import { useMatchTime } from "./time-zone-context";

/** Champions already celebrated this visit: the burst is for opening, not for every tab switch. */
const celebrated = new Set<string>();

/**
 * "Beat Argentina 1–0 in the final", read off the final itself; "Won the
 * final" where the score or the other side is missing.
 */
function finalLine(championId: string, final: BracketMatch, teams: Map<string, Team>): string {
  const atHome = final.homeTeamId === championId;
  const runnerUpId = atHome ? final.awayTeamId : final.homeTeamId;
  const runnerUp = runnerUpId ? teams.get(runnerUpId) : undefined;
  const won = atHome ? final.homeScore : final.awayScore;
  const lost = atHome ? final.awayScore : final.homeScore;
  return runnerUp && won != null && lost != null
    ? `Beat ${runnerUp.shortName} ${won}–${lost} in the final`
    : "Won the final";
}

/**
 * Who won a competition, above its tabs: the crest, the name, how the final
 * went and when — and, the first time it is opened in a visit, confetti from
 * the crest. `aside` is whatever the competition says next (LoL's leagues
 * coming back).
 */
export function ChampionCard({
  competition,
  championId,
  final,
  teams,
  aside,
}: {
  /** "FIFA World Cup 2026", "MSI 2026". */
  competition: string;
  championId: string;
  final: BracketMatch;
  teams: Map<string, Team>;
  aside?: ReactNode;
}) {
  const format = useMatchTime();
  const crest = useRef<HTMLDivElement>(null);
  const winner = teams.get(championId);
  const result = finalLine(championId, final, teams);

  useEffect(() => {
    const key = `${competition}:${championId}`;
    if (celebrated.has(key) || !crest.current) return;
    celebrated.add(key);
    const box = crest.current.getBoundingClientRect();
    burstConfetti({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  }, [competition, championId]);

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-4 @2xl:flex-row @2xl:items-center @2xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div ref={crest}>{winner && <TeamBadge team={winner} size="lg" />}</div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <Eyebrow size="sm" as="div" className="flex items-center gap-1.5">
              <Trophy aria-hidden className="size-3.5 text-warning" />
              {competition} champions
            </Eyebrow>
            <Heading level="h5" as="p" className="truncate">
              {winner?.name ?? championId}
            </Heading>
            <Text variant="small" as="div">
              {final.date ? `${result} · ${format.shortDay(final.date)}` : result}
            </Text>
          </div>
        </div>
        {aside}
      </CardContent>
    </Card>
  );
}
