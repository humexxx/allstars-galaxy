"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mono, Text } from "@/components/ui/typography";
import { isBracketDrawn } from "@/lib/sports/bracket";
import { cn } from "@/lib/utils";
import { formatDayRange } from "@/lib/utils/date";
import type { NbaConference, NbaCup as NbaCupData, NbaCupGroup, NbaCupGroupRow, Team } from "@/types/sports";

import { KnockoutBracket } from "../shared/knockout-bracket";
import { SportsTh, TableCard } from "../shared/table-primitives";
import { SectionHeading } from "../shared/tile-section";
import { TeamBadge } from "../shared/team-badge";

const CONFERENCE_NAME: Record<NbaConference, string> = { east: "East", west: "West" };

// Categorical slots in order: who goes through, and how.
const ADVANCING_BAND: Record<NonNullable<NbaCupGroupRow["advancing"]>, string> = {
  winner: "bg-chart-1",
  wildcard: "bg-chart-2",
};
const ADVANCING_LABEL: Record<NonNullable<NbaCupGroupRow["advancing"]>, string> = {
  winner: "Group winner",
  wildcard: "Wildcard",
};

/**
 * The NBA Cup's tab: the knockout (a bracket once ESPN names its teams, its
 * dates until then) above the six groups, East then West, three across on a
 * wide screen and one under another on a phone.
 */
export function NbaCup({ cup, teams }: { cup: NbaCupData; teams: Map<string, Team> }): React.ReactElement {
  const drawn = isBracketDrawn(cup.knockout);
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <SectionHeading>Knockout rounds</SectionHeading>
        {drawn ? (
          <Card size="sm">
            <CardContent>
              <KnockoutBracket rounds={cup.knockout} teams={teams} />
            </CardContent>
          </Card>
        ) : (
          <Card size="sm">
            <CardContent className="flex flex-col gap-3">
              <ol className="grid gap-3 sm:grid-cols-3">
                {cup.knockoutDates.map((round) => (
                  <li key={round.label} className="flex flex-col gap-0.5">
                    <Text as="span" weight="medium">
                      {round.label}
                    </Text>
                    <Mono className="text-xs text-muted-foreground">{formatDayRange(round.from, round.to)}</Mono>
                  </li>
                ))}
              </ol>
              <Text variant="small">
                The six group winners and each conference&apos;s best runner-up go through.
                {cup.groupNightsLeft > 0 &&
                  ` ${cup.groupNightsLeft} group ${cup.groupNightsLeft === 1 ? "night" : "nights"} to play.`}{" "}
                Every Cup game but the final counts in the standings.
              </Text>
            </CardContent>
          </Card>
        )}
      </section>

      {(["east", "west"] as const).map((conference) => {
        const groups = cup.groups.filter((g) => g.conference === conference);
        if (groups.length === 0) return null;
        return (
          <section key={conference} className="flex flex-col gap-2">
            <SectionHeading>{CONFERENCE_NAME[conference]} groups</SectionHeading>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((group, i) => (
                <CupGroupTable
                  key={group.id}
                  group={group}
                  title={`Group ${i + 1}`}
                  label={`${CONFERENCE_NAME[conference]} group ${i + 1}`}
                  teams={teams}
                />
              ))}
            </div>
          </section>
        );
      })}

      <ul role="list" aria-label="Key" className="flex flex-wrap gap-x-4 gap-y-1">
        {(["winner", "wildcard"] as const).map((kind) => (
          <li key={kind} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("h-3 w-1 rounded-sm", ADVANCING_BAND[kind])} />
            <Text variant="small" as="span">
              {ADVANCING_LABEL[kind]}, as it stands
            </Text>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CupGroupTable({
  group,
  title,
  label,
  teams,
}: {
  group: NbaCupGroup;
  title: string;
  label: string;
  teams: Map<string, Team>;
}): React.ReactElement {
  return (
    <TableCard title={title}>
      <Table aria-label={label}>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <SportsTh className="w-8 pl-3" label="Position">
              #
            </SportsTh>
            <SportsTh>Team</SportsTh>
            <SportsTh className="w-10 text-center" label="Wins">
              W
            </SportsTh>
            <SportsTh className="w-10 text-center" label="Losses">
              L
            </SportsTh>
            <SportsTh className="w-14 pr-3 text-right" label="Point difference">
              PD
            </SportsTh>
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.rows.map((row, i) => {
            const team = teams.get(row.teamId);
            return (
              <TableRow key={row.teamId} className="hover:bg-transparent">
                <TableCell className="relative pl-3 text-sm tabular-nums text-muted-foreground">
                  {row.advancing && (
                    <span
                      aria-hidden
                      className={cn("absolute inset-y-1 left-0 w-1 rounded-r-sm", ADVANCING_BAND[row.advancing])}
                    />
                  )}
                  {i + 1}
                  {row.advancing && <span className="sr-only">, {ADVANCING_LABEL[row.advancing]}</span>}
                </TableCell>
                <TableHead scope="row" className="w-full max-w-0 font-normal text-foreground">
                  <span className="flex min-w-0 items-center gap-2">
                    {team && <TeamBadge team={team} size="sm" />}
                    <span className={cn("truncate text-sm", i === 0 && "font-semibold")}>
                      {team?.shortName ?? row.teamId}
                    </span>
                  </span>
                </TableHead>
                <TableCell className="text-center">
                  <Mono className="text-sm">{row.won}</Mono>
                </TableCell>
                <TableCell className="text-center">
                  <Mono className="text-sm">{row.lost}</Mono>
                </TableCell>
                <TableCell className="pr-3 text-right">
                  <Mono className={cn("text-sm", row.pointDiff < 0 && "text-destructive")}>
                    {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                  </Mono>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableCard>
  );
}
