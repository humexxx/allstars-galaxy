import Link from "next/link";
import { ArrowRight, Star, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eyebrow, Text } from "@/components/ui/typography";
import {
  getDashboardSportsSummary,
  listUserFavoriteSportIds,
} from "@/lib/services/sports-service";
import { cn } from "@/lib/utils";
import type { DashboardSportHighlight } from "@/types/sports";

import { StatusPill } from "./shared/status-pill";

const SPORTS_PATH = "/portal/entertainment/sports";

type DashboardSportsCardProps = {
  userId: string;
};

export async function DashboardSportsCard({ userId }: DashboardSportsCardProps) {
  // F1 has a card of its own on this dashboard, with its news under the same
  // highlight. Listing it here too would print the same race twice.
  const [favorites, highlights] = await Promise.all([
    listUserFavoriteSportIds(userId),
    getDashboardSportsSummary(userId, ["f1"]),
  ]);

  // Following only F1 is not the same as following nothing: the card that
  // owns F1 is already on screen, so this one steps aside rather than asking
  // for favourites somebody has already picked.
  if (highlights.length === 0 && favorites.length > 0) return null;

  if (highlights.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Trophy className="size-5" aria-hidden />
            Sports
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Text variant="muted">
            Pick a few favorite sports to see live results, standings and the
            next big match right here on your dashboard.
          </Text>
          <Button asChild>
            <Link href={SPORTS_PATH}>
              <Star /> Pick favorites
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <Trophy className="size-5" aria-hidden />
          Sports
        </CardTitle>
        <CardDescription>
          Following {favorites.length} {favorites.length === 1 ? "sport" : "sports"} · live
          highlights and table leaders
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href={SPORTS_PATH}>
              Open <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "grid gap-3",
            highlights.length === 1 && "grid-cols-1",
            highlights.length === 2 && "sm:grid-cols-2",
            highlights.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3"
          )}
        >
          {highlights.map((h) => (
            // Now that the hub keeps its sport in the URL, a highlight can
            // point straight at the one it is about instead of dropping the
            // reader on whatever the hub opens with.
            <Link
              key={h.sportId}
              href={`${SPORTS_PATH}?sport=${h.sportId}`}
              className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <HighlightCard highlight={h} />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HighlightCard({ highlight }: { highlight: DashboardSportHighlight }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-md bg-muted text-base"
          >
            {highlight.emoji}
          </span>
          <Eyebrow>{highlight.label}</Eyebrow>
        </div>
        <ToneBadge tone={highlight.tone} />
      </div>
      <div className="min-h-10">
        <Text as="div" weight="semibold" className="leading-snug">
          {highlight.headline}
        </Text>
        <Text variant="small" as="div" className="mt-0.5">
          {highlight.context}
        </Text>
      </div>
      {highlight.secondary && (
        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2 text-xs">
          <span className="text-muted-foreground">{highlight.secondary.label}</span>
          <span className="font-mono font-medium tabular-nums">{highlight.secondary.value}</span>
        </div>
      )}
    </div>
  );
}

function ToneBadge({ tone }: { tone?: DashboardSportHighlight["tone"] }) {
  if (!tone) return null;
  if (tone === "result") return <StatusPill status="completed" label="Result" />;
  return <StatusPill status={tone} />;
}
