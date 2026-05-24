import Link from "next/link";
import { ArrowRight, Circle, Star, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { getDashboardSportsSummary } from "@/lib/services/sports-service";
import { cn } from "@/lib/utils";
import type { DashboardSportHighlight } from "@/types/sports";

const SPORTS_PATH = "/portal/entertainment/sports";

type DashboardSportsCardProps = {
  userId: string;
};

export async function DashboardSportsCard({ userId }: DashboardSportsCardProps) {
  const highlights = await getDashboardSportsSummary(userId);

  if (highlights.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Sports
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Text variant="muted" className="text-sm">
            Pick a few favorite sports to see live results, standings and the
            next big match right here on your dashboard.
          </Text>
          <Button asChild>
            <Link href={SPORTS_PATH}>
              <Star className="mr-1 h-4 w-4" /> Pick favorites
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Sports
            </CardTitle>
            <Text variant="muted" className="mt-1 text-sm">
              Following {highlights.length}{" "}
              {highlights.length === 1 ? "sport" : "sports"} · live highlights
              and table leaders
            </Text>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={SPORTS_PATH}>
              Open hub <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
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
            <HighlightCard key={h.sportId} highlight={h} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HighlightCard({ highlight }: { highlight: DashboardSportHighlight }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-md bg-muted text-base"
          >
            {highlight.emoji}
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {highlight.label}
          </span>
        </div>
        <ToneBadge tone={highlight.tone} />
      </div>
      <div className="min-h-[2.5rem]">
        <div className="text-sm font-semibold leading-snug">{highlight.headline}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{highlight.context}</div>
      </div>
      {highlight.secondary && (
        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2 text-xs">
          <span className="text-muted-foreground">{highlight.secondary.label}</span>
          <span className="font-medium">{highlight.secondary.value}</span>
        </div>
      )}
    </div>
  );
}

function ToneBadge({ tone }: { tone?: DashboardSportHighlight["tone"] }) {
  if (!tone) return null;
  if (tone === "live") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        <Circle className="h-2 w-2 animate-pulse fill-current" /> Live
      </span>
    );
  }
  if (tone === "upcoming") {
    return (
      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
        Upcoming
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      Result
    </span>
  );
}
