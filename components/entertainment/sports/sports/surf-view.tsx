"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CalendarDays, ChevronRight, Lock, MapPin, Trophy, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import { featuredEvent } from "@/lib/data/sports/surf";
import { cn } from "@/lib/utils";
import { formatDayRange } from "@/lib/utils/date";
import type { SurfData, SurfDraw, SurfEvent, SurfHeat, SurfRanking, SurfSurfer } from "@/types/sports";

import { OverviewSplit } from "../shared/overview-split";
import { Portrait } from "../shared/portrait";
import { ShowMoreRows, useShownRows } from "../shared/show-more";
import { SportShell } from "../shared/sport-shell";
import { StatusPill } from "../shared/status-pill";
import { SportsTh, TableCard } from "../shared/table-primitives";
import { EarlierPill, SectionHeading, TileSection, useRevealEarlier } from "../shared/tile-section";

type SurfViewProps = {
  data: SurfData;
  /** `?tab=draw` or `?tab=overview`; otherwise the stop on now opens on its draw. */
  initialTab?: string;
};

type SurfTab = "overview" | "draw";

/**
 * The men's Championship Tour, laid out as padel's and tennis's tours:
 * Overview (the stop on now, else next, else the last surfed, the season
 * around it and the rankings beside them) and Draw (the featured stop's heats,
 * round by round). Draw stays on the strip, locked, until a draw exists.
 */
export function SurfView({ data, initialTab }: SurfViewProps): React.ReactElement {
  const featured = data.events.find((e) => e.id === data.draw?.eventId) ?? featuredEvent(data.events);
  const draw = data.draw && data.draw.rounds.length > 0 ? data.draw : undefined;
  const opening: SurfTab =
    draw && (initialTab === "draw" || (initialTab !== "overview" && featured?.status === "live")) ? "draw" : "overview";
  const [tab, setTab] = useState<string>(opening);
  // A refresh can take the draw away while it is open.
  const shownTab = tab === "draw" && !draw ? "overview" : tab;

  return (
    <Tabs value={shownTab} onValueChange={setTab} className="gap-6">
      <SportShell
        emoji={SPORTS_BY_ID.get("surf")?.emoji ?? "🏄"}
        title="Surfing"
        subtitle={`Championship Tour · Season ${data.season}`}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="draw" disabled={!draw}>
              {!draw && <Lock aria-hidden />}
              Draw
            </TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="overview">
          <OverviewSplit
            matches={
              <SurfOverview
                events={data.events}
                featured={featured}
                draw={draw}
                onOpenDraw={draw ? () => setTab("draw") : undefined}
              />
            }
            table={data.rankings.length > 0 && <RankingsTable rankings={data.rankings} />}
            tableLabel="Rankings"
          />
        </TabsContent>

        {draw && (
          <TabsContent value="draw">
            <DrawTab draw={draw} event={featured} />
          </TabsContent>
        )}
      </SportShell>
    </Tabs>
  );
}

// ---------- Overview ----------

function sectionTitle(event: SurfEvent): string {
  if (event.status === "live") return "On now";
  if (event.status === "upcoming") return "Next up";
  return "Last event";
}

/** What the "Earlier" pill brings in: "Show Fiji Pro – Tahiti Pro", or one name. */
function showNames(list: SurfEvent[]): string {
  return list.length > 1 ? `Show ${list[0].name} – ${list[list.length - 1].name}` : `Show ${list[0]?.name ?? ""}`;
}

/**
 * The left of the Overview, as padel's and tennis's: the featured stop big,
 * any other stop on at the same time (one left on standby while the next
 * opens), every stop still to come as tiles, and the ones surfed (latest first, each
 * naming its winner), the last three shown and three more a tap.
 */
function SurfOverview({
  events,
  featured,
  draw,
  onOpenDraw,
}: {
  events: SurfEvent[];
  featured: SurfEvent | undefined;
  draw?: SurfDraw;
  onOpenDraw?: () => void;
}): React.ReactElement {
  const alsoOn = events.filter((e) => e.status === "live" && e.id !== featured?.id);
  const ahead = events.filter((e) => e.status === "upcoming" && e.id !== featured?.id);
  const played = useMemo(
    () => events.filter((e) => e.status === "completed" && e.id !== featured?.id).reverse(),
    [events, featured?.id]
  );
  const { listRef, earlier, next, reveal } = useRevealEarlier(played, { open: true, attr: "data-tournament" });

  if (!featured) {
    return <EmptyState icon={CalendarDays} title="No events on the calendar for this tour." />;
  }

  return (
    <div ref={listRef} className="@container flex min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-2">
        <SectionHeading>{sectionTitle(featured)}</SectionHeading>
        <FeaturedEvent event={featured} draw={draw} onOpenDraw={onOpenDraw} />
      </section>

      {alsoOn.length > 0 && (
        <TileSection title="Also on">
          {alsoOn.map((e) => (
            <EventTile key={e.id} event={e} />
          ))}
        </TileSection>
      )}

      {ahead.length > 0 && (
        <TileSection title="Coming up">
          {ahead.map((e) => (
            <EventTile key={e.id} event={e} />
          ))}
        </TileSection>
      )}

      {played.length > 0 && (
        <TileSection
          title="Earlier events"
          action={next.length > 0 && <EarlierPill detail={showNames(next)} onClick={reveal} />}
        >
          {earlier.map((e) => (
            <EventTile key={e.id} event={e} />
          ))}
        </TileSection>
      )}
    </div>
  );
}

/**
 * Where a draw being surfed has got to: the heat in the water, else the
 * round under way or the one next.
 */
function roundUnderWay(draw: SurfDraw): string | null {
  for (const round of draw.rounds) {
    const live = round.heats.find((h) => h.status === "live");
    if (live) return `${round.label}, heat ${live.number} in the water`;
  }
  const next = draw.rounds.find((r) => r.heats.some((h) => h.status !== "completed"));
  if (!next) return null;
  return next.heats.some((h) => h.status === "completed") ? `${next.label} under way` : `${next.label} next`;
}

function WinnerLine({ winner, runnerUp }: { winner: string; runnerUp?: string }): React.ReactElement {
  return (
    <>
      <span className="font-medium">{winner}</span>
      {runnerUp && (
        <span className="text-muted-foreground">
          {" "}
          <span aria-hidden>d.</span>
          <span className="sr-only">defeated</span> {runnerUp}
        </span>
      )}
    </>
  );
}

type Fact = { label: string; icon: LucideIcon; iconClassName?: string; value: ReactNode };

/** The stop's facts, one a line behind its icon, as a tournament's are. */
function EventFacts({ event }: { event: SurfEvent }): React.ReactElement {
  const facts: Fact[] = [
    { label: "Dates", icon: CalendarDays, value: <Mono>{formatDayRange(event.startDate, event.endDate)}</Mono> },
  ];
  if (event.location) facts.push({ label: "Location", icon: MapPin, value: event.location });
  if (event.winner) {
    facts.push({
      label: "Winner",
      icon: Trophy,
      iconClassName: "text-warning",
      value: <WinnerLine winner={event.winner} runnerUp={event.runnerUp} />,
    });
  }

  return (
    <dl className="flex flex-col gap-2">
      {facts.map(({ label, icon: Icon, iconClassName, value }) => (
        <div key={label} className="flex items-start gap-2 text-sm">
          <dt className="flex h-6 shrink-0 items-center text-muted-foreground">
            <Icon aria-hidden className={cn("size-4", iconClassName)} />
            <span className="sr-only">{label}</span>
          </dt>
          <dd className="min-w-0 leading-6">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The featured stop: its state and number, its facts, the winner once the
 * Final is surfed, and at its foot the round under way beside the way to the
 * draw.
 */
function FeaturedEvent({
  event,
  draw,
  onOpenDraw,
}: {
  event: SurfEvent;
  draw?: SurfDraw;
  onOpenDraw?: () => void;
}): React.ReactElement {
  const line = event.status === "live" && !event.winner && draw ? roundUnderWay(draw) : null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Event {event.stop}</Badge>
          <StatusPill status={event.status} />
        </div>
        <Heading level="h3">{event.name}</Heading>
        <EventFacts event={event} />
        {(line || onOpenDraw) && (
          <div className="mt-auto flex items-center justify-end gap-3 pt-2">
            {line && (
              <Text variant="muted" className="mr-auto">
                {line}
              </Text>
            )}
            {onOpenDraw && (
              <Button variant="outline" size="sm" onClick={onOpenDraw}>
                View draw
                <ChevronRight data-icon="inline-end" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * One stop as a tile: what, where, when, and who won once somebody has. Not
 * a link — a stop has no page of its own — but focusable, for the "Earlier"
 * pill to hand the focus to.
 */
function EventTile({ event }: { event: SurfEvent }): React.ReactElement {
  return (
    <div
      data-tournament={event.id}
      tabIndex={-1}
      className="flex w-full flex-col gap-2 rounded-lg border bg-card p-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col leading-tight">
          <Eyebrow size="sm">Event {event.stop}</Eyebrow>
          <Text asChild weight="semibold" className="truncate">
            <h3>{event.name}</h3>
          </Text>
        </div>
        {event.status === "live" && <StatusPill status="live" />}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {event.location && (
          <Text variant="small" className="truncate">
            {event.location}
          </Text>
        )}
        <Mono className="text-xs text-muted-foreground">{formatDayRange(event.startDate, event.endDate)}</Mono>
      </div>
      {event.winner && (
        <div className="flex items-start gap-2 border-t pt-2 text-xs">
          <Trophy aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <span className="min-w-0">
            <span className="sr-only">Winner: </span>
            <WinnerLine winner={event.winner} runnerUp={event.runnerUp} />
          </span>
        </div>
      )}
    </div>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

/**
 * A surfer's face (with the flag on it, where one is published), else the
 * initials; a seed not drawn yet is an empty disc.
 */
function SurferFace({
  name,
  imageUrl,
  flagUrl,
  placeholder = false,
  size,
}: {
  name: string;
  imageUrl?: string;
  flagUrl?: string;
  placeholder?: boolean;
  size: "md" | "table";
}): React.ReactElement {
  return (
    <Portrait
      size={size}
      subject={{ name, imageUrl, flagUrl }}
      fallback={
        <span className="grid size-full place-items-center rounded-full bg-muted text-2xs font-medium text-muted-foreground">
          {placeholder ? null : initialsOf(name)}
        </span>
      }
    />
  );
}

function RankingsTable({ rankings }: { rankings: SurfRanking[] }): React.ReactElement {
  const rows = useShownRows(rankings);
  return (
    <TableCard>
      <Table aria-label="Rankings">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <SportsTh className="w-10 pl-3" label="Rank">
              #
            </SportsTh>
            <SportsTh>Surfer</SportsTh>
            <SportsTh className="pr-3 text-right" label="Points">
              Pts
            </SportsTh>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.shown.map((r) => (
            <TableRow key={r.athleteId}>
              <TableCell className="pl-3 text-sm tabular-nums text-muted-foreground">{r.position}</TableCell>
              <TableHead scope="row" className="font-normal text-foreground">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <SurferFace name={r.name} imageUrl={r.imageUrl} flagUrl={r.flagUrl} size="table" />
                  <span className="text-sm font-medium">{r.name}</span>
                  {/* The flag is a picture on the face; its country, read once here. */}
                  {r.country && <span className="sr-only">{`, ${r.country}`}</span>}
                </div>
              </TableHead>
              <TableCell className="pr-3 text-right">
                <Mono className="text-sm font-semibold">{r.points.toLocaleString("en-US")}</Mono>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ShowMoreRows rows={rows} className="border-t py-1" />
    </TableCard>
  );
}

// ---------- Draw ----------

/** The featured stop's heats, a section a round, each heat a card. */
function DrawTab({ draw, event }: { draw: SurfDraw; event?: SurfEvent }): React.ReactElement {
  return (
    <div className="@container flex flex-col gap-6">
      {event && (
        <Text variant="muted">
          {event.name} · <Mono>{formatDayRange(event.startDate, event.endDate)}</Mono>
        </Text>
      )}
      {draw.rounds.map((round, i) => (
        <section key={`${i}-${round.label}`} className="flex flex-col gap-2">
          <SectionHeading>{round.label}</SectionHeading>
          <ol className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
            {round.heats.map((heat) => (
              <li key={heat.id}>
                <HeatCard heat={heat} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function HeatCard({ heat }: { heat: SurfHeat }): React.ReactElement {
  const decided = heat.status === "completed";
  return (
    <Card size="sm" className="h-full">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Heading level="h6" as="h3">
            Heat {heat.number}
          </Heading>
          <StatusPill status={heat.status} />
        </div>
        <ul className="flex flex-col gap-2">
          {heat.surfers.map((surfer, i) => (
            <SurferRow
              key={surfer.athleteId ?? `${i}-${surfer.name}`}
              surfer={surfer}
              decided={decided}
              won={decided && surfer.place === 1}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * A surfer in a heat: face, name and heat total. Once the heat is over its
 * winner is bold and the rest step back; a seed not drawn yet stays muted.
 */
function SurferRow({
  surfer,
  decided,
  won,
}: {
  surfer: SurfSurfer;
  decided: boolean;
  won: boolean;
}): React.ReactElement {
  const placeholder = !surfer.athleteId;
  return (
    <li
      className={cn("flex items-center gap-2 text-sm", (placeholder || (decided && !won)) && "text-muted-foreground")}
    >
      <SurferFace name={surfer.name} imageUrl={surfer.imageUrl} placeholder={placeholder} size="md" />
      <span className={cn("min-w-0 flex-1 truncate", won && "font-semibold")}>{surfer.name}</span>
      {won && <span className="sr-only">, won</span>}
      {surfer.score !== null && (
        <Mono className={cn("text-sm", won && "font-semibold")}>{surfer.score.toFixed(2)}</Mono>
      )}
    </li>
  );
}
