"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { Standing, Team } from "@/types/sports";

import { ShowMoreRows, useShownRows } from "./show-more";
import { SportsTh, TableCellNum } from "./table-primitives";
import { TeamBadge } from "./team-badge";

type StandingsTableProps = {
  standings: Standing[];
  teams: Map<string, Team>;
};

// Qualification bands are categories, not states: the first two take the
// categorical chart slots in order; the rest keep their status meaning.
const BAND_STYLES: Record<string, string> = {
  champions: "bg-chart-1",
  europa: "bg-chart-2",
  conference: "bg-success",
  playoff: "bg-warning",
  relegation: "bg-destructive",
};

// Narrow on a phone, so the club's name keeps the room and Pts — the one
// column everybody reads — never leaves the right edge of a 390px screen.
const NUM_TH = "w-8 px-1 text-center sm:w-12 sm:px-2";
const NUM_TD = "px-1 sm:px-2";

/**
 * A league or group table cut to #, club, played, goal difference and points:
 * it sits in a side column (the football overview, a World Cup group), where
 * a full table was clipped before it ever reached the points.
 */
export function StandingsTable({ standings, teams }: StandingsTableProps): React.ReactElement {
  const rows = useShownRows(standings);
  // No frame or scroller of its own: callers sit it flush in a TableCard,
  // and `Table` already scrolls. A second scroller broke horizontal swipes.
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <SportsTh className="w-8 pl-3">#</SportsTh>
            <SportsTh>Club</SportsTh>
            <SportsTh className={NUM_TH}>
              <abbr title="Matches played" className="no-underline">MP</abbr>
            </SportsTh>
            <SportsTh className={NUM_TH}>
              <abbr title="Goal difference" className="no-underline">GD</abbr>
            </SportsTh>
            <SportsTh className="w-10 px-1 text-center text-foreground sm:w-14 sm:px-2">Pts</SportsTh>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.shown.map((row) => {
            const team = teams.get(row.teamId);
            const goalDiff = row.goalsFor - row.goalsAgainst;
            const bandClass = row.band ? BAND_STYLES[row.band] : null;
            return (
              <TableRow key={row.teamId} className="relative">
                <TableCell className="relative pl-3 text-sm tabular-nums text-muted-foreground">
                  {bandClass && (
                    <span
                      aria-hidden
                      className={cn("absolute inset-y-1 left-0 w-1 rounded-r-sm", bandClass)}
                    />
                  )}
                  {row.position}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {team && <TeamBadge team={team} size="sm" />}
                    <span className="truncate">{team?.shortName ?? row.teamId}</span>
                  </div>
                </TableCell>
                <TableCellNum value={row.played} className={NUM_TD} />
                <TableCellNum
                  value={`${goalDiff > 0 ? "+" : ""}${goalDiff}`}
                  className={cn(NUM_TD, goalDiff >= 0 ? "text-foreground" : "text-destructive")}
                />
                <TableCell className="px-1 text-center sm:px-2">
                  <Mono className="text-sm font-semibold tabular-nums">{row.points}</Mono>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ShowMoreRows rows={rows} className="border-t py-1" />
    </>
  );
}
