"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { FootballLeagueId, Standing, StandingBand, Team } from "@/types/sports";

import { ShowMoreRows, useShownRows } from "./show-more";
import { SportsTh, TableCellNum } from "./table-primitives";
import { TeamBadge } from "./team-badge";
import { usePickTeam } from "./team-filter-context";
import { TeamPick } from "./team-pick";

type Zone = NonNullable<StandingBand>;

type StandingsTableProps = {
  standings: Standing[];
  teams: Map<string, Team>;
  /** Names its zones: a band leads somewhere different in each competition. */
  competition: FootballLeagueId;
  /** The table's accessible name: the league, the group. */
  label?: string;
};

// Qualification bands are categories, not states: the first two take the
// categorical chart slots in order; the rest keep their status meaning.
const BAND_STYLES: Record<Zone, string> = {
  champions: "bg-chart-1",
  europa: "bg-chart-2",
  conference: "bg-success",
  playoff: "bg-warning",
  relegation: "bg-destructive",
};

const DOMESTIC_ZONES: Partial<Record<Zone, string>> = {
  champions: "Champions League",
  europa: "Europa League",
  conference: "Conference League",
  relegation: "Relegation",
};

// "champions" is the Champions League from a European league, but the next
// round from the UCL's league phase, a World Cup group or a league that ends
// in play-offs (MLS, Costa Rica) — see `ZONE_BAND_DEFAULTS`.
const ZONE_LABELS: Record<FootballLeagueId, Partial<Record<Zone, string>>> = {
  "premier-league": DOMESTIC_ZONES,
  "la-liga": DOMESTIC_ZONES,
  "serie-a": DOMESTIC_ZONES,
  "ligue-1": { ...DOMESTIC_ZONES, playoff: "Relegation play-off" },
  "bundesliga": { ...DOMESTIC_ZONES, playoff: "Relegation play-off" },
  mls: { champions: "Round One", playoff: "Wild card" },
  "costa-rica": { champions: "Semi-finals" },
  "uefa-champions-league": { champions: "Round of 16", playoff: "Knockout play-off" },
  "world-cup": { champions: "Round of 32", playoff: "Best third places" },
};

// Narrow on a phone, so the club's name keeps the room and Pts — the one
// column everybody reads — never leaves the right edge of a 390px screen.
const NUM_TH = "w-8 px-1 text-center sm:w-12 sm:px-2";
const NUM_TD = "px-1 sm:px-2";

/**
 * A league or group table cut to #, club, played, goal difference and points:
 * it sits in a side column (the football overview, a World Cup group), where
 * a full table was clipped before it ever reached the points.
 *
 * A row's zone is a coloured stripe, so it is also named: in the position cell
 * for a screen reader, and in a key under the table for the eye.
 */
export function StandingsTable({
  standings,
  teams,
  competition,
  label,
}: StandingsTableProps): React.ReactElement {
  const rows = useShownRows(standings);
  // A team's name is what a tap picks, with its own hover: the row keeps still.
  const pickable = usePickTeam() !== null;
  const zoneLabels = ZONE_LABELS[competition];
  const zones = [...new Set(rows.shown.map((row) => row.band))].filter(
    (band): band is Zone => !!band && !!zoneLabels[band]
  );
  // No frame or scroller of its own: callers sit it flush in a TableCard,
  // and `Table` already scrolls. A second scroller broke horizontal swipes.
  return (
    <>
      <Table aria-label={label}>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <SportsTh className="w-8 pl-3" label="Position">
              #
            </SportsTh>
            <SportsTh>Club</SportsTh>
            <SportsTh className={NUM_TH} label="Matches played">
              <abbr title="Matches played" className="no-underline">MP</abbr>
            </SportsTh>
            <SportsTh className={NUM_TH} label="Goal difference">
              <abbr title="Goal difference" className="no-underline">GD</abbr>
            </SportsTh>
            <SportsTh className="w-10 px-1 text-center text-foreground sm:w-14 sm:px-2" label="Points">
              Pts
            </SportsTh>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.shown.map((row) => {
            const team = teams.get(row.teamId);
            const goalDiff = row.goalsFor - row.goalsAgainst;
            const zoneLabel = row.band ? zoneLabels[row.band] : undefined;
            return (
              <TableRow key={row.teamId} className={cn("relative", pickable && "hover:bg-transparent")}>
                <TableCell className="relative pl-3 text-sm tabular-nums text-muted-foreground">
                  {row.band && (
                    <span
                      aria-hidden
                      className={cn("absolute inset-y-1 left-0 w-1 rounded-r-sm", BAND_STYLES[row.band])}
                    />
                  )}
                  {row.position}
                  {zoneLabel && <span className="sr-only">, {zoneLabel}</span>}
                </TableCell>
                {/* The row's header, so a cell down the Pts column is read with its club. */}
                <TableHead scope="row" className="h-auto py-2 font-normal text-foreground">
                  {team ? (
                    <TeamPick team={team}>
                      <TeamBadge team={team} size="sm" />
                      <span className="truncate">{team.shortName}</span>
                    </TeamPick>
                  ) : (
                    row.teamId
                  )}
                </TableHead>
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
      {zones.length > 0 && (
        <ul role="list" aria-label="Key" className="flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-2">
          {zones.map((zone) => (
            <li key={zone} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("h-3 w-1 rounded-sm", BAND_STYLES[zone])} />
              <Text variant="small" as="span">
                {zoneLabels[zone]}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
