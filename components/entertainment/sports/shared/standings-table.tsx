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

import { Last5Form } from "./last-5-form";
import { SportsTh, TableCellNum } from "./table-primitives";
import { TeamBadge } from "./team-badge";

type StandingsTableProps = {
  standings: Standing[];
  teams: Map<string, Team>;
  /** Show the form column when the data set carries it. */
  showForm?: boolean;
  /**
   * `compact` keeps only #, club, played, goal difference and points — for a
   * side column (the football overview), where the full table was clipped
   * before it ever reached the points.
   */
  variant?: "full" | "compact";
  className?: string;
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

// Narrow on a phone: seven 48px stat columns pushed Pts — the one column
// everybody reads — off the right edge of a 390px screen.
const NUM_TH = "w-8 px-1 text-center sm:w-12 sm:px-2";
const NUM_TD = "px-1 sm:px-2";
/** Goals for/against: the first thing a phone can do without. */
const WIDE_ONLY = "hidden sm:table-cell";

export function StandingsTable({
  standings,
  teams,
  showForm = true,
  variant = "full",
  className,
}: StandingsTableProps) {
  const compact = variant === "compact";
  const hasForm = !compact && showForm && standings.some((s) => s.form && s.form.length > 0);

  return (
    // No frame or scroller of its own: callers sit it flush in a TableCard,
    // and `Table` already scrolls. A second scroller broke horizontal swipes.
    <Table className={className}>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <SportsTh className="w-8 pl-3">#</SportsTh>
          <SportsTh>Club</SportsTh>
          <SportsTh className={NUM_TH}>
            <abbr title="Matches played" className="no-underline">MP</abbr>
          </SportsTh>
          {!compact && (
            <>
              <SportsTh className={NUM_TH}>W</SportsTh>
              <SportsTh className={NUM_TH}>D</SportsTh>
              <SportsTh className={NUM_TH}>L</SportsTh>
              <SportsTh className={cn(NUM_TH, WIDE_ONLY)}>GF</SportsTh>
              <SportsTh className={cn(NUM_TH, WIDE_ONLY)}>GA</SportsTh>
            </>
          )}
          <SportsTh className={NUM_TH}>
            <abbr title="Goal difference" className="no-underline">GD</abbr>
          </SportsTh>
          <SportsTh className="w-10 px-1 text-center text-foreground sm:w-14 sm:px-2">Pts</SportsTh>
          {hasForm && (
            // Five chips are wider than the rest of a tablet's table.
            <SportsTh className="hidden text-center lg:table-cell">Last 5</SportsTh>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((row) => {
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
              {!compact && (
                <>
                  <TableCellNum value={row.won} className={NUM_TD} />
                  <TableCellNum value={row.drawn} className={NUM_TD} />
                  <TableCellNum value={row.lost} className={NUM_TD} />
                  <TableCellNum value={row.goalsFor} className={cn(NUM_TD, WIDE_ONLY)} />
                  <TableCellNum value={row.goalsAgainst} className={cn(NUM_TD, WIDE_ONLY)} />
                </>
              )}
              <TableCellNum
                value={`${goalDiff > 0 ? "+" : ""}${goalDiff}`}
                className={cn(NUM_TD, goalDiff >= 0 ? "text-foreground" : "text-destructive")}
              />
              <TableCell className="px-1 text-center sm:px-2">
                <Mono className="text-sm font-semibold tabular-nums">{row.points}</Mono>
              </TableCell>
              {hasForm && (
                <TableCell className="hidden text-center lg:table-cell">
                  {row.form && row.form.length > 0 ? (
                    <Last5Form
                      results={row.form}
                      className="justify-center"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
