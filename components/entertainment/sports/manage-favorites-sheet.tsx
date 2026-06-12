"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/typography";
import { SPORTS } from "@/lib/data/sports/registry";
import { cn } from "@/lib/utils";
import type { SportId } from "@/types/sports";

import { setSportFavoriteAction } from "@/app/actions/sports";

type ManageFavoritesSheetProps = {
  favoriteSportIds: SportId[];
};

export function ManageFavoritesSheet({ favoriteSportIds }: ManageFavoritesSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<SportId>>(
    () => new Set(favoriteSportIds)
  );
  // One in-flight flag PER sport — a single slot meant toggling A then B
  // quickly let A's completion clear B's spinner (and re-enable B's switch)
  // while B's action was still running.
  const [pending, setPending] = useState<Set<SportId>>(() => new Set());
  const [, startTransition] = useTransition();

  const count = selected.size;

  async function handleToggle(sportId: SportId, next: boolean) {
    // Optimistic — flip the chip immediately, revert if the action fails.
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(sportId);
      else copy.delete(sportId);
      return copy;
    });
    setPending((prev) => new Set(prev).add(sportId));
    const result = await setSportFavoriteAction({ sportId, isFavorite: next });
    setPending((prev) => {
      const copy = new Set(prev);
      copy.delete(sportId);
      return copy;
    });
    if (!result.success) {
      setSelected((prev) => {
        const copy = new Set(prev);
        if (next) copy.delete(sportId);
        else copy.add(sportId);
        return copy;
      });
      toast.error(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Star className="mr-1.5 h-4 w-4" />
          Manage favorites
          {count > 0 && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-semibold text-primary">
              {count}
            </span>
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
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-xl"
                  >
                    {sport.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{sport.label}</div>
                    <Text variant="small" as="div">
                      {sport.shortLabel}
                    </Text>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPending && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                    <Switch
                      checked={isOn}
                      disabled={isPending}
                      onCheckedChange={(value) => handleToggle(sport.id, value)}
                      aria-label={`Toggle ${sport.label} as favorite`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {count === 0 && (
            <Text variant="muted" className="mt-4 text-center text-xs">
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
