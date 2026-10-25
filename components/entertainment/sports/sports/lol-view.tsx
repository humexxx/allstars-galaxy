"use client";

import {
  Fragment,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from "react";
import { CalendarX, Lock, RotateCw } from "lucide-react";

import { getLolSplitAction } from "@/app/actions/lol";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { isBracketDrawn } from "@/lib/sports/bracket";
import {
  isLolLeague,
  type LolChampion,
  type LolData,
  type LolMatch,
  type LolRegion,
  type LolSplit,
  type LolUpcoming,
  type Team,
} from "@/types/sports";

import { ChampionCard } from "../shared/champion-card";
import { KnockoutBracket } from "../shared/knockout-bracket";
import { Last5Form } from "../shared/last-5-form";
import { SportShell } from "../shared/sport-shell";
import { STATUS_LABEL, SwissBracket } from "../shared/swiss-bracket";
import { ShowMoreRows, useShownRows } from "../shared/show-more";
import { SportsTh, TableCard } from "../shared/table-primitives";
import { TeamBadge } from "../shared/team-badge";
import { useMatchTime } from "../shared/time-zone-context";

type LolViewProps = {
  data: LolData;
};

type SplitState =
  | { status: "loading" }
  | { status: "ready"; split: LolSplit }
  | { status: "error"; error: string };

/**
 * A league's other splits this season, read when one is picked and kept for
 * the visit; a failure is forgotten, so picking it again asks again.
 */
function useLeagueSplits(): {
  states: Record<string, SplitState>;
  load: (region: LolRegion, tournamentId: string) => void;
} {
  const [states, setStates] = useState<Record<string, SplitState>>({});
  const asked = useRef(new Set<string>());
  const load = useCallback((region: LolRegion, tournamentId: string) => {
    if (!isLolLeague(region) || asked.current.has(tournamentId)) return;
    asked.current.add(tournamentId);
    setStates((s) => ({ ...s, [tournamentId]: { status: "loading" } }));
    void getLolSplitAction({ region, tournamentId }).then((result) => {
      if (!result.success) asked.current.delete(tournamentId);
      setStates((s) => ({
        ...s,
        [tournamentId]: result.success
          ? { status: "ready", split: result.data }
          : { status: "error", error: result.error ?? "The split could not be loaded" },
      }));
    });
  }, []);
  return { states, load };
}

export function LolView({ data }: LolViewProps): ReactElement {
  const [region, setRegion] = useState<LolRegion>(data.splits[0]?.region ?? "lec");
  const latest = useMemo(
    () => data.splits.find((s) => s.region === region) ?? data.splits[0],
    [data.splits, region],
  );
  const [picked, setPicked] = useState<Partial<Record<LolRegion, string>>>({});
  const { states, load } = useLeagueSplits();
  const pickedId = picked[region];
  const other = pickedId && pickedId !== latest.tournamentId ? states[pickedId] : undefined;
  const split = other?.status === "ready" ? other.split : latest;
  const pickSplit = (id: string): void => {
    setPicked((p) => ({ ...p, [region]: id }));
    if (id !== latest.tournamentId) load(region, id);
  };
  const pickedName = latest.seasonSplits?.find((s) => s.id === pickedId)?.name;
  const teamsMap = useMemo(
    () => new Map<string, Team>(split.teams.map((t) => [t.id, t])),
    [split],
  );
  const menuId = useId();
  const splitsRef = useRef<HTMLDivElement>(null);

  const playoffs = split.playoffs && split.playoffs.length > 0 ? split.playoffs : null;
  // A bracket that exists but names nobody is not somewhere to land: opening
  // on it showed "not drawn yet" as the first thing on the page while the
  // split's actual matches sat one tab away.
  const playoffsDrawn = playoffs !== null && isBracketDrawn(playoffs);
  // Worlds' main stage until its knockouts are drawn, so it is where to land.
  const swiss = split.swiss ?? null;
  const playIns = split.playIns && split.playIns.length > 0 ? split.playIns : null;
  const hasMatches = split.matches.length > 0;
  // An international event is its stages, a tab each in the order they are
  // played — play-ins, Swiss stage, playoffs — and lands on the latest one
  // under way: the playoffs once drawn (locked till then), else the Swiss
  // stage, else the play-ins. A league keeps its matches and its table, and so
  // does an event whose only stage is a bracket not drawn yet: it has no stage
  // under way to land on.
  const stages = Boolean(split.international) && (playIns !== null || swiss !== null || playoffsDrawn);
  const opening = playoffsDrawn
    ? "playoffs"
    : swiss
      ? "swiss"
      : stages && playIns
        ? "play-ins"
        : !hasMatches && split.standings.length > 0
          ? "standings"
          : "matches";

  // Each split opens on its own tab: one without playoffs, picked while on
  // "playoffs", would otherwise be left on a tab it has no panel for (a blank
  // body). Reset here, not by keying the Tabs: that remounted the shell too,
  // and the title menu or split pill just used lost the focus to <body>.
  const viewKey = `${region}-${split.tournamentId ?? ""}`;
  const [tab, setTab] = useState(opening);
  const [tabFor, setTabFor] = useState(viewKey);
  if (tabFor !== viewKey) {
    setTabFor(viewKey);
    setTab(opening);
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-6">
      <SportShell
        emoji="🎮"
        // The competition on screen names the page, as football's league
        // does; the sport goes under it. "Worlds 2026" already names its
        // year; "LEC Split 3" does not.
        title={split.name}
        subtitle={split.name.includes(String(split.season)) ? "League of Legends" : `League of Legends · ${split.season}`}
        titleMenu={
          <DropdownMenuRadioGroup value={region} onValueChange={(v) => setRegion(v as LolRegion)}>
            {/* International events first: they are the ones that matter most. */}
            {[
              { label: "International", splits: data.splits.filter((s) => s.international) },
              { label: "Leagues", splits: data.splits.filter((s) => !s.international) },
            ]
              .filter((group) => group.splits.length > 0)
              .map((group, i) => (
                <DropdownMenuGroup key={group.label} aria-labelledby={`${menuId}-${i}`}>
                  {i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel id={`${menuId}-${i}`}>{group.label}</DropdownMenuLabel>
                  {group.splits.map((s) => (
                    <DropdownMenuRadioItem key={s.region} value={s.region}>
                      {s.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuGroup>
              ))}
          </DropdownMenuRadioGroup>
        }
        tabs={
          <TabsList variant="line">
            {!stages && <TabsTrigger value="matches">Matches</TabsTrigger>}
            {stages && playIns && <TabsTrigger value="play-ins">Play-ins</TabsTrigger>}
            {/* Worlds' Swiss stage publishes no table until it is played. */}
            {split.standings.length > 0 && (
              <TabsTrigger value="standings">Standings</TabsTrigger>
            )}
            {swiss && <TabsTrigger value="swiss">Swiss stage</TabsTrigger>}
            {playoffs && (
              <TabsTrigger value="playoffs" disabled={stages && !playoffsDrawn}>
                {stages && !playoffsDrawn && <Lock aria-hidden />}
                Playoffs
              </TabsTrigger>
            )}
          </TabsList>
        }
      >
        <div className="flex flex-col gap-4">
          {latest.seasonSplits && latest.seasonSplits.length > 1 && latest.tournamentId && (
            <SeasonSplits
              ref={splitsRef}
              season={latest.season}
              splits={latest.seasonSplits}
              value={pickedId ?? latest.tournamentId}
              onPick={pickSplit}
            />
          )}
          <p role="status" className="sr-only">
            {other?.status === "loading"
              ? `Loading ${pickedName ?? "the split"}…`
              : other?.status === "error"
                ? other.error
                : ""}
          </p>
          {other && other.status !== "ready" ? (
            <SplitPending
              state={other}
              onRetry={() => {
                // "Try again" goes the moment the retry starts; the pill it
                // retries is still there to hold the focus.
                splitsRef.current?.querySelector<HTMLElement>('[data-state="on"]')?.focus();
                if (pickedId) load(region, pickedId);
              }}
            />
          ) : (
            // Drawn anew for each split: its champion, brackets and the
            // table's "Show more" start over.
            <Fragment key={viewKey}>
              {split.champion && (
                <LolSeasonEnd
                  split={split}
                  champion={split.champion}
                  teams={teamsMap}
                  upcoming={split === data.splits[0] ? data.upcoming ?? [] : []}
                />
              )}

              {stages && playIns && (
                <TabsContent value="play-ins">
                  <Card size="sm">
                    <CardContent>
                      <KnockoutBracket rounds={playIns} teams={teamsMap} links={split.playInLinks} />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {!stages && (
                <TabsContent value="matches">
                  {hasMatches ? (
                    <ul role="list" className="grid gap-2 @xl:grid-cols-2">
                      {split.matches.map((m) => (
                        <LolMatchCard key={m.id} match={m} teams={teamsMap} />
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      icon={CalendarX}
                      title="No matches to show"
                      description="Lolesports has not sent this split's schedule."
                    />
                  )}
                </TabsContent>
              )}

              {split.standings.length > 0 && (
                <TabsContent value="standings">
                  <LolStandings split={split} teamsMap={teamsMap} />
                </TabsContent>
              )}

              {swiss && (
                <TabsContent value="swiss">
                  <Card size="sm">
                    <CardContent>
                      <SwissBracket stage={swiss} teams={teamsMap} />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {playoffs && (
                <TabsContent value="playoffs">
                  <Card size="sm">
                    <CardContent>
                      <KnockoutBracket rounds={playoffs} teams={teamsMap} links={split.playoffLinks} />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Fragment>
          )}
        </div>
      </SportShell>
    </Tabs>
  );
}

/**
 * A league's splits this season, a pill each — "Split 1", "Split 2" — to move
 * between from inside the league; the picker above offers only its latest.
 */
function SeasonSplits({
  ref,
  season,
  splits,
  value,
  onPick,
}: {
  ref?: Ref<HTMLDivElement>;
  season: string;
  splits: Array<{ id: string; name: string }>;
  value: string;
  onPick: (id: string) => void;
}): ReactElement {
  return (
    <div ref={ref} className="flex flex-wrap items-center gap-2">
      <Eyebrow size="sm" as="span">
        {season}
      </Eyebrow>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={value}
        onValueChange={(id) => id && onPick(id)}
        aria-label={`Splits of ${season}`}
      >
        {splits.map((s) => (
          <ToggleGroupItem
            key={s.id}
            value={s.id}
            aria-label={s.name}
            className="h-6 rounded-full px-2.5 data-[state=on]:border-primary data-[state=on]:text-foreground"
          >
            {/* "LCK Split 2" under the league's own name: "Split 2". */}
            {s.name.replace(/^\S+\s/, "")}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** A split being read, or one that could not be. */
function SplitPending({
  state,
  onRetry,
}: {
  state: Exclude<SplitState, { status: "ready" }>;
  onRetry: () => void;
}): ReactElement {
  if (state.status === "loading") {
    return (
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  return (
    <EmptyState
      icon={CalendarX}
      title={state.error}
      description="Lolesports did not answer. It usually does on a second try."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw />
          Try again
        </Button>
      }
    />
  );
}

/**
 * Who won the split on screen, and when each league is back. After Worlds the
 * hub opened on a finished bracket with nothing saying the season was over.
 */
function LolSeasonEnd({
  split,
  champion,
  teams,
  upcoming,
}: {
  split: LolSplit;
  champion: LolChampion;
  teams: Map<string, Team>;
  upcoming: LolUpcoming[];
}): ReactElement {
  const format = useMatchTime();
  return (
    <ChampionCard
      competition={split.name}
      championId={champion.teamId}
      final={champion.final}
      teams={teams}
      aside={
        // Only once Lolesports lists them: before that there is no date to give.
        upcoming.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t pt-3 @2xl:min-w-64 @2xl:border-t-0 @2xl:border-l @2xl:pt-0 @2xl:pl-4">
            <Eyebrow size="sm" as="div">
              Next up
            </Eyebrow>
            <ul className="flex flex-col gap-1">
              {upcoming.map((u) => (
                <li key={u.region} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium">{u.name}</span>
                  <Mono className="shrink-0 text-2xs text-muted-foreground">{format.day(u.startDate)}</Mono>
                </li>
              ))}
            </ul>
          </div>
        )
      }
    />
  );
}

function LolMatchCard({
  match,
  teams,
}: {
  match: LolMatch;
  teams: Map<string, Team>;
}): ReactElement | null {
  const format = useMatchTime();
  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  if (!home || !away) return null;
  const isScheduled = match.status === "scheduled";
  const isLive = match.status === "live";
  const homeWon =
    match.homeScore !== null &&
    match.awayScore !== null &&
    match.homeScore > match.awayScore;
  const awayWon =
    match.homeScore !== null &&
    match.awayScore !== null &&
    match.awayScore > match.homeScore;

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-1.5">
        {match.stageLabel && (
          <Eyebrow size="sm" as="div">
            {match.stageLabel} · <span aria-hidden>BO{match.bestOf}</span>
            <span className="sr-only">best of {match.bestOf}</span>
          </Eyebrow>
        )}
        <LolTeamRow team={home} score={match.homeScore} winner={homeWon} scheduled={isScheduled} />
        <LolTeamRow team={away} score={match.awayScore} winner={awayWon} scheduled={isScheduled} />
      </div>
      {/* Same column as `ScoreCard`: the status over the day for a result,
          the day over the time for a fixture. */}
      <div className="flex min-w-16 flex-col items-end justify-center gap-0.5 border-l pl-3 text-right">
        {!isScheduled && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground",
              isLive && "text-foreground",
            )}
          >
            {isLive && <span aria-hidden className="size-2 rounded-full bg-success motion-safe:animate-pulse" />}
            {STATUS_LABEL[match.status]}
          </span>
        )}
        {!isLive && (
          <Mono className="text-2xs text-muted-foreground">{format.shortDay(match.date)}</Mono>
        )}
        {isScheduled && (
          <Mono className="text-2xs text-muted-foreground">{format.time(match.date)}</Mono>
        )}
      </div>
    </li>
  );
}

function LolTeamRow({
  team,
  score,
  winner,
  scheduled,
}: {
  team: Team;
  score: number | null;
  winner: boolean;
  scheduled: boolean;
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <TeamBadge team={team} size="sm" />
        <span className={cn("truncate", winner && "font-semibold")}>{team.shortName}</span>
      </div>
      {!scheduled && score !== null && (
        <Mono
          className={cn(
            "text-sm tabular-nums",
            winner ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {score}
        </Mono>
      )}
    </div>
  );
}

function LolStandings({
  split,
  teamsMap,
}: {
  split: LolSplit;
  teamsMap: Map<string, Team>;
}): ReactElement {
  const rows = useShownRows(split.standings);
  return (
    <TableCard>
        <Table aria-label={`${split.name} standings`}>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SportsTh className="w-8 pl-3">
                #
              </SportsTh>
              <SportsTh>
                Team
              </SportsTh>
              <SportsTh className="text-center" label="Wins">
                W
              </SportsTh>
              <SportsTh className="text-center" label="Losses">
                L
              </SportsTh>
              <SportsTh className="text-center">
                Last 5
              </SportsTh>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.shown.map((row) => {
              const team = teamsMap.get(row.teamId);
              return (
                <TableRow key={row.teamId}>
                  <TableCell className="pl-3 text-sm tabular-nums text-muted-foreground">
                    {row.position}
                  </TableCell>
                  <TableHead scope="row" className="font-normal text-foreground">
                    <div className="flex items-center gap-2">
                      {team && <TeamBadge team={team} size="sm" />}
                      <span className="text-sm">{team?.shortName ?? row.teamId}</span>
                    </div>
                  </TableHead>
                  <TableCell className="text-center">
                    <Mono className="text-sm">{row.wins}</Mono>
                  </TableCell>
                  <TableCell className="text-center">
                    <Mono className="text-sm">{row.losses}</Mono>
                  </TableCell>
                  <TableCell>
                    {row.form && (
                      <Last5Form results={row.form} className="justify-center" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <ShowMoreRows rows={rows} className="border-t py-1" />
    </TableCard>
  );
}
