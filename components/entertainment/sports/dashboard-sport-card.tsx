import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { getDashboardSportCard } from "@/lib/services/sports-service";
import { cn } from "@/lib/utils";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import type { DashboardMatch, DashboardSide, SportId } from "@/types/sports";

import { DashboardSportTables } from "./dashboard-sport-tables";
import { FeatureBox } from "./shared/feature-box";
import { matchTimeFormat, type MatchTimeFormat } from "./shared/match-time";
import { StatusPill } from "./shared/status-pill";
import { TeamBadge } from "./shared/team-badge";

const SPORTS_PATH = "/portal/entertainment/sports";

/**
 * One favourite sport on the dashboard, laid out like the F1 card: what is on
 * now or next, what follows it, and the top of the table.
 *
 * Half a row, like F1's: one sport among several. Each card sits in its own
 * Suspense boundary, so a slow provider only holds up its own sport.
 */
export async function DashboardSportCard({ sportId }: { sportId: SportId }) {
  const [card, timeZone] = await Promise.all([getDashboardSportCard(sportId), getRequestTimeZone()]);
  if (!card) return null;
  // The reader's zone, not the server's (UTC): an evening kickoff in Costa
  // Rica is that evening, not tomorrow.
  const format = matchTimeFormat(timeZone);
  const href = `${SPORTS_PATH}?sport=${card.sportId}`;
  const groups = groupCardMatches(card.matches);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        {/* The hub's emoji: lucide has no ball for most of these sports. */}
        <CardTitle as="h2" className="flex items-center gap-2">
          <span aria-hidden className="text-lg leading-none">
            {card.emoji}
          </span>
          {card.label}
        </CardTitle>
        <CardDescription className="truncate">{card.context}</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href={href}>
              Open <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {card.featured && <FeaturedMatch match={card.featured} format={format} href={href} />}

        {card.event && (
          <Link
            href={href}
            className="flex items-start justify-between gap-2 rounded-lg border bg-card p-2.5 transition-colors hover:bg-muted/40"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold leading-snug">
                {card.event.name}
              </span>
              <Text variant="small" as="span" className="block truncate">
                {card.event.detail}
              </Text>
            </span>
            <StatusPill status={card.event.status} />
          </Link>
        )}

        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1.5">
            <Eyebrow size="sm">{group.label}</Eyebrow>
            <ul className="flex flex-col gap-1">
              {group.matches.map((m) => (
                <MatchLine key={m.id} match={m} format={format} />
              ))}
            </ul>
          </div>
        ))}

        {card.tables.length > 0 && <DashboardSportTables tables={card.tables} />}

        {card.note && (
          <div className="flex flex-col gap-1">
            <Eyebrow size="sm">{card.note.title}</Eyebrow>
            {card.note.text && <span className="text-xs font-medium">{card.note.text}</span>}
            {card.note.when && (
              <Text variant="small" as="span">
                {card.note.when.label} {format.weekdayDay(card.note.when.startsAt)}
              </Text>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
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

function badgeTeam(side: DashboardSide) {
  return {
    name: side.name,
    shortName: side.name,
    code: side.code,
    primaryColor: side.color,
    logoUrl: side.logoUrl,
  };
}

/** The status column: live with its minute, the kickoff, or the final. */
function MatchStatus({ match, format }: { match: DashboardMatch; format: MatchTimeFormat }) {
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

function FeaturedMatch({
  match,
  format,
  href,
}: {
  match: DashboardMatch;
  format: MatchTimeFormat;
  href: string;
}) {
  const decided = match.status === "result";
  return (
    <FeatureBox
      href={href}
      label={match.label ?? ""}
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
    </FeatureBox>
  );
}

/** A fixture or result on one line, the score or the kickoff between the teams. */
function MatchLine({ match, format }: { match: DashboardMatch; format: MatchTimeFormat }) {
  const scored = match.status !== "upcoming" && match.home.score !== null && match.away.score !== null;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-md px-1.5 py-1 text-xs odd:bg-muted/40">
      <span className="flex min-w-0 items-center justify-end gap-1.5">
        <span className={cn("truncate", match.home.winner && "font-semibold")}>{match.home.name}</span>
        <TeamBadge team={badgeTeam(match.home)} size="sm" />
      </span>
      <span className="flex w-16 flex-col items-center leading-tight">
        {scored ? (
          <Mono className={cn("text-xs font-semibold", match.status === "live" && "text-success")}>
            {match.home.score}–{match.away.score}
          </Mono>
        ) : (
          <Mono className="text-2xs">{format.time(match.startsAt)}</Mono>
        )}
        <Mono className="text-2xs text-muted-foreground">
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
