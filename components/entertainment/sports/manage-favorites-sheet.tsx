"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/typography";
import { SPORTS } from "@/lib/data/sports/registry";
import { cn } from "@/lib/utils";
import type { SportId } from "@/types/sports";

import { setSportFavoriteAction } from "@/app/actions/sports";

/**
 * What following a sport gets you. The row used to repeat the sport's short
 * label under its name — "Football / Football", "NBA / NBA" — which said
 * nothing twice.
 */
const COVERAGE: Record<SportId, string> = {
  football: "Champions League, Premier League, La Liga, Serie A",
  worldcup: "Knockout bracket, fixtures and group tables",
  padel: "Premier Padel rankings and tournaments",
  f1: "Drivers, constructors, races and news",
  nba: "Scores and conference standings",
  tennis: "ATP and WTA rankings and draws",
  nfl: "Scores, standings and playoffs",
  lol: "LEC, LCS, LCK and LPL",
};

type ManageFavoritesSheetProps = {
  favoriteSportIds: SportId[];
};

export function ManageFavoritesSheet({ favoriteSportIds }: ManageFavoritesSheetProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<SportId>>(
    () => new Set(favoriteSportIds)
  );
  // One in-flight flag PER sport — a single slot meant toggling A then B
  // quickly let A's completion clear B's spinner (and re-enable B's switch)
  // while B's action was still running.
  const [pending, setPending] = useState<Set<SportId>>(() => new Set());

  const count = selected.size;

  async function handleToggle(sportId: SportId, next: boolean): Promise<void> {
    // A second toggle while the first is in flight is ignored rather than
    // blocked with `disabled`, which would drop keyboard focus off the switch.
    if (pending.has(sportId)) return;
    // Optimistic — flip the chip immediately, revert if the action fails.
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(sportId);
      else copy.delete(sportId);
      return copy;
    });
    setPending((prev) => new Set(prev).add(sportId));
    // A rejection (network) must still clear the spinner and roll back.
    const result = await setSportFavoriteAction({ sportId, isFavorite: next }).catch(
      () => ({ success: false as const, error: "Failed to update favorites" })
    );
    setPending((prev) => {
      const copy = new Set(prev);
      copy.delete(sportId);
      return copy;
    });
    // No refresh on success: the action revalidates the hub and the dashboard.
    if (!result.success) {
      setSelected((prev) => {
        const copy = new Set(prev);
        if (next) copy.delete(sportId);
        else copy.add(sportId);
        return copy;
      });
      toast.error(result.error);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Star />
          Manage favorites
          {count > 0 && (
            <Badge variant="info" className="tabular-nums">
              {count}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Favorite sports</SheetTitle>
          <SheetDescription>
            Pick the sports you want to follow. Favorites surface as highlights
            on your dashboard and get a star on the Sports hub.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <ul className="divide-y divide-border rounded-lg border">
            {SPORTS.map((sport) => {
              const isOn = selected.has(sport.id);
              const isPending = pending.has(sport.id);
              return (
                <li
                  key={sport.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 transition-colors",
                    isOn && "bg-primary/5"
                  )}
                >
                  <span
                    aria-hidden
                    className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xl"
                  >
                    {sport.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Text as="div" weight="medium">
                      {sport.label}
                    </Text>
                    <Text variant="small" as="div">
                      {COVERAGE[sport.id]}
                    </Text>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPending && <Spinner className="size-3.5 text-muted-foreground" />}
                    <Switch
                      checked={isOn}
                      aria-disabled={isPending}
                      aria-busy={isPending}
                      onCheckedChange={(value) => handleToggle(sport.id, value)}
                      aria-label={`Toggle ${sport.label} as favorite`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {count === 0 && (
            <Text variant="small" className="mt-4 text-center">
              Toggle any sport on to start tracking it.
            </Text>
          )}
        </div>

        <SheetFooter>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
