import { Fragment, type ComponentProps, type ReactElement } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { getDashboardSportCard } from "@/lib/services/sports-service";
import { sportPath } from "@/lib/sports/paths";
import { cn } from "@/lib/utils";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import type {
  DashboardMatch,
  DashboardSide,
  DashboardSportCard as DashboardSportCardData,
  SportId,
} from "@/types/sports";

import { DashboardCompetitionPicker } from "./dashboard-competition-picker";
import { DashboardSportTables } from "./dashboard-sport-tables";
import { SPORT_CARD_HEADER, SPORT_CARD_ROWS, SPORT_CARD_SECTION } from "./shared/dashboard-card-rows";
import { FeatureBox } from "./shared/feature-box";
import { LeadCarousel } from "./shared/lead-carousel";
import { matchTimeFormat, type MatchTimeFormat } from "./shared/match-time";
import { NewsRail } from "./shared/news-rail";
import { StatusPill } from "./shared/status-pill";
import { TeamBadge } from "./shared/team-badge";

/**
 * One favourite sport on the dashboard, laid out like the F1 card: what is on
 * now or next, what follows it, and the top of the table — for the
 * championship the reader set it to (`competition`, null for the card's own
 * pick), which the line under the title picks.
 *
 * Football, the NBA and the NFL step through their next games in the lead box
 * (`following`) rather than listing them, so their table moves up a row and
 * their news has the last row to itself.
 *
 * Half a row, like F1's: one sport among several. Each card sits in its own
 * Suspense boundary, so a slow provider only holds up its own sport.
 */
export async function DashboardSportCard({
  sportId,
  competition = null,
}: {
  sportId: SportId;
  competition?: string | null;
}): Promise<ReactElement | null> {
  const [card, timeZone] = await Promise.all([
    getDashboardSportCard(sportId, competition),
    getRequestTimeZone(),
  ]);
  if (!card) return null;
  // The reader's zone, not the server's (UTC): an evening kickoff in Costa
  // Rica is that evening, not tomorrow.
  const format = matchTimeFormat(timeZone);
  const href = hubHref(card);
  const groups = groupCardMatches(card.matches);

  const list =
    groups.length > 0 &&
    groups.map((group) => (
      <div key={group.label} className="flex flex-col gap-1.5">
        <Eyebrow size="sm" asChild>
          <h3>{group.label}</h3>
        </Eyebrow>
        <ul role="list" className="flex flex-col gap-1">
          {group.matches.map((m) => (
            <MatchLine key={m.id} match={m} format={format} />
          ))}
        </ul>
      </div>
    ));
  const tables = (card.tables.length > 0 || card.note) && (
    <>
      {card.tables.length > 0 && <DashboardSportTables tables={card.tables} />}
      {card.note && (
        <div className="flex flex-col gap-1">
          <Eyebrow size="sm" asChild>
            <h3>{card.note.title}</h3>
          </Eyebrow>
          {card.note.text && <span className="text-xs font-medium">{card.note.text}</span>}
          {card.note.when && (
            <Text variant="small" as="span">
              {card.note.when.label} {format.weekdayDay(card.note.when.startsAt)}
            </Text>
          )}
        </div>
      )}
    </>
  );
  const news = card.news && card.news.length > 0 && <NewsRail sport={card.label} stories={card.news} format={format} />;
  // The list, the tables and the news fill the two rows under the lead in that
  // order, so a card with nothing to list leaves no empty row beside its
  // neighbour's.
  const [middle, ...rest] = [list, tables, news].filter(Boolean);

  return (
    <Card className={SPORT_CARD_ROWS}>
      <CardHeader className={SPORT_CARD_HEADER}>
        {/* The hub's emoji: lucide has no ball for most of these sports. */}
        <CardTitle as="h2" className="flex items-center gap-2">
          <span aria-hidden className="text-lg leading-none">
            {card.emoji}
          </span>
          {card.label}
        </CardTitle>
        {card.competitions ? (
          <CardDescription className="min-w-0">
            <DashboardCompetitionPicker
              sportId={card.sportId}
              label={card.context}
              competitions={card.competitions}
            />
          </CardDescription>
        ) : (
          <CardDescription className="truncate">{card.context}</CardDescription>
        )}
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href={href}>
              Open <span className="sr-only">{card.label}</span> <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      {/* Three rows, always all three: a fourth would put this card's out of
          line with the one beside it. */}
      <div className={SPORT_CARD_SECTION}>
        {card.featured &&
          (card.following ? (
            // Keyed by the game it leads with: another championship's games
            // start from their own first one, not where the last were left.
            <LeadCarousel key={card.featured.id} label={`${card.label} games`}>
              {[card.featured, ...(card.following ?? [])].map((m) => (
                // Room under the teams for the carousel's dots.
                <FeaturedMatch key={m.id} match={m} format={format} href={href} className="pb-6" />
              ))}
            </LeadCarousel>
          ) : (
            <FeaturedMatch match={card.featured} format={format} href={href} />
          ))}
        {card.event && <FeaturedEvent event={card.event} href={href} />}
      </div>

      <div className={SPORT_CARD_SECTION}>{middle}</div>
      <div className={SPORT_CARD_SECTION}>
        {rest.map((part, i) => (
          <Fragment key={i}>{part}</Fragment>
        ))}
      </div>
    </Card>
  );
}

/** The sport in the hub, and for football the league the card is set to. */
function hubHref(card: DashboardSportCardData): string {
  const league = card.sportId === "football" ? card.competitions?.value : null;
  return league ? `${sportPath("football")}&league=${league}` : sportPath(card.sportId);
}

type MatchGroup = { label: string; matches: DashboardMatch[] };

/**
 * The list under the featured match, one labelled group per kind, each in
 * the order the service sent. The list was named after its first match, so a
 * fixture on top put the results under it beneath "Up next".
 */
export function groupCardMatches(matches: DashboardMatch[]): MatchGroup[] {
  const groups: MatchGroup[] = [
    { label: "Live", matches: matches.filter((m) => m.status === "live") },
    { label: "Up next", matches: matches.filter((m) => m.status === "upcoming") },
    { label: "Latest results", matches: matches.filter((m) => m.status === "result") },
  ];
  return groups.filter((group) => group.matches.length > 0);
}

function badgeTeam(side: DashboardSide): ComponentProps<typeof TeamBadge>["team"] {
  return {
    name: side.name,
    shortName: side.name,
    code: side.code,
    primaryColor: side.color,
    logoUrl: side.logoUrl,
  };
}

/** The status column: live with its minute, the kickoff, or the final. */
function MatchStatus({ match, format }: { match: DashboardMatch; format: MatchTimeFormat }): React.ReactElement {
  if (match.status === "live") {
    return <StatusPill status="live" label={match.minute ? `Live ${match.minute}'` : undefined} />;
  }
  return (
    <Mono className="shrink-0 text-2xs text-muted-foreground">
      {match.status === "upcoming"
        ? `${format.shortDay(match.startsAt)} · ${format.time(match.startsAt)}`
        : `Final · ${format.shortDay(match.startsAt)}`}
    </Mono>
  );
}

/** For a match its league gives no label to (the NBA's, the NFL's off week). */
const MATCH_LABEL: Record<DashboardMatch["status"], string> = {
  live: "Live now",
  upcoming: "Next up",
  result: "Latest result",
};

function FeaturedMatch({
  match,
  format,
  href,
  className,
}: {
  match: DashboardMatch;
  format: MatchTimeFormat;
  href: string;
  className?: string;
}): React.ReactElement {
  const decided = match.status === "result";
  // A shoot-out stays out of the score, so two level sides with a winner went to penalties.
  const shootOut =
    decided && match.home.score !== null && match.home.score === match.away.score
      ? [match.home, match.away].find((side) => side.winner)
      : undefined;
  return (
    <FeatureBox
      href={href}
      className={className}
      label={match.label ?? MATCH_LABEL[match.status]}
      status={<MatchStatus match={match} format={format} />}
    >
      {[match.home, match.away].map((side, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-sm">
          <span
            className={cn(
              "flex min-w-0 items-center gap-2",
              decided && !side.winner && "text-muted-foreground"
            )}
          >
            <TeamBadge team={badgeTeam(side)} size="sm" />
            <span className={cn("truncate", side.winner && "font-semibold")}>{side.name}</span>
          </span>
          {side.score !== null && (
            <Mono className={cn("text-sm", side.winner ? "font-semibold" : decided && "text-muted-foreground")}>
              {side.score}
            </Mono>
          )}
        </div>
      ))}
      {shootOut && (
        <Text variant="small" as="span">
          {shootOut.name} won on penalties
        </Text>
      )}
    </FeatureBox>
  );
}

const EVENT_LABEL: Record<NonNullable<DashboardSportCardData["event"]>["status"], string> = {
  live: "On now",
  upcoming: "Next up",
  completed: "Just finished",
};

/** A tournament (tennis, padel) in the same box as a match or a race. */
function FeaturedEvent({
  event,
  href,
}: {
  event: NonNullable<DashboardSportCardData["event"]>;
  href: string;
}): React.ReactElement {
  return (
    <FeatureBox href={href} label={EVENT_LABEL[event.status]} status={<StatusPill status={event.status} />}>
      <span className="truncate text-sm font-semibold">{event.name}</span>
      <Text variant="small" as="span" className="truncate">
        {event.detail}
      </Text>
    </FeatureBox>
  );
}

/** A fixture or result on one line, the score or the kickoff between the teams. */
function MatchLine({ match, format }: { match: DashboardMatch; format: MatchTimeFormat }): React.ReactElement {
  const scored = match.status !== "upcoming" && match.home.score !== null && match.away.score !== null;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-md px-1.5 py-1 text-xs odd:bg-muted/40">
      <span className="flex min-w-0 items-center justify-end gap-1.5">
        <span className={cn("truncate", match.home.winner && "font-semibold")}>{match.home.name}</span>
        <TeamBadge team={badgeTeam(match.home)} size="sm" />
      </span>
      <span className="flex w-16 flex-col items-center leading-tight">
        {scored ? (
          <Mono className="text-xs font-semibold">
            {match.home.score}–{match.away.score}
          </Mono>
        ) : (
          <Mono className="text-2xs">{format.time(match.startsAt)}</Mono>
        )}
        <Mono className="flex items-center gap-1 text-2xs text-muted-foreground">
          {match.status === "live" && <span aria-hidden className="size-1.5 rounded-full bg-success" />}
          {match.status === "live" ? "Live" : format.shortDay(match.startsAt)}
        </Mono>
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <TeamBadge team={badgeTeam(match.away)} size="sm" />
        <span className={cn("truncate", match.away.winner && "font-semibold")}>{match.away.name}</span>
      </span>
    </li>
  );
}
