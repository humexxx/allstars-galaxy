"use client";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Heading } from "@/components/ui/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { RacquetTournament } from "@/types/sports";

import { StatusPill } from "../shared/status-pill";
import { DrawBody, type DrawState, type DrawVariant } from "./racquet-draw";
import { TournamentFacts, TournamentPoster } from "./racquet-tournaments";

/**
 * One tournament's details and its draw: from the bottom on a phone, from
 * the right on a desktop.
 *
 * `tournament` outlives `open`, so the sheet keeps its content while it
 * slides away instead of emptying first.
 */
export function RacquetTournamentSheet({
  tournament,
  open,
  onOpenChange,
  draw,
  variant,
  onRetry,
}: {
  tournament: RacquetTournament | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draw: DrawState;
  variant: DrawVariant;
  onRetry: () => void;
}) {
  const isMobile = useIsMobile();

  return (
    <Sheet open={open && tournament !== undefined} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        // A bracket wants width: the sheet's own 24rem shows one round of four.
        className={cn("gap-0", isMobile ? "max-h-5/6" : "data-[side=right]:sm:max-w-3xl")}
      >
        {tournament && (
          <>
            <SheetHeader className="pr-14">
              {(tournament.tier || tournament.status === "live") && (
                <div className="flex flex-wrap items-center gap-2">
                  {tournament.tier && <Badge variant="outline">{tournament.tier}</Badge>}
                  {tournament.status === "live" && <StatusPill status="live" />}
                </div>
              )}
              <SheetTitle asChild>
                <Heading level="h5" as="h2">
                  {tournament.name}
                </Heading>
              </SheetTitle>
              <SheetDescription>
                {tournament.status === "completed"
                  ? "Finished"
                  : tournament.status === "live"
                    ? "Being played"
                    : "Coming up"}
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6">
              {tournament.imageUrl && (
                <TournamentPoster key={tournament.imageUrl} src={tournament.imageUrl} />
              )}
              <TournamentFacts tournament={tournament} variant={variant} />
              <section className="flex flex-col gap-3">
                <Heading level="h6" as="h3">
                  Draw
                </Heading>
                <DrawBody tournament={tournament} state={draw} variant={variant} onRetry={onRetry} />
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
