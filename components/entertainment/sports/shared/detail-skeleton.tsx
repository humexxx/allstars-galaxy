import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { ShellHeadSkeleton } from "../sports-navigation";

/**
 * A padel or tennis tournament's page while it loads (`loading.tsx`): laid
 * out as the page is, the sport's name row with the breadcrumb's longer
 * title and the tabs, then the Bracket it opens on: its rounds' chips and the
 * draw as a tree, each round half the one before — as many rounds as the
 * width shows, two on a phone, where the draw scrolls the rest in. A status for a screen reader
 * beside it.
 */
export function TournamentPageSkeleton(): React.ReactElement {
  return (
    <>
      <span role="status" className="sr-only">
        Loading tournament…
      </span>
      <div className="@container flex flex-col">
        <ShellHeadSkeleton title="w-72" />
        <div className="flex flex-col gap-3 pt-6" aria-hidden="true">
          <Skeleton className="h-8 w-full max-w-md rounded-lg" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4 @5xl:grid-cols-6">
            {[8, 4, 2, 1, 1, 1].map((ties, round) => (
              <div
                key={round}
                className={cn(
                  "flex flex-col justify-around gap-3",
                  round > 1 && "hidden @3xl:flex",
                  round > 3 && "@3xl:hidden @5xl:flex"
                )}
              >
                <Skeleton className="h-3 w-20" />
                {Array.from({ length: ties }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * A race's page while it loads (`loading.tsx`): laid out as the page is, F1's
 * name row with the breadcrumb's longer title and the tabs, then the
 * Overview it opens on: the circuit's card beside the podium, pole and
 * fastest lap and the weekend's timetable — a race run, as most pages opened
 * are. A status for a screen reader beside it.
 */
export function RacePageSkeleton(): React.ReactElement {
  return (
    <>
      <span role="status" className="sr-only">
        Loading race…
      </span>
      <div className="@container flex flex-col">
        <ShellHeadSkeleton title="w-72" />
        <div className="grid gap-6 pt-6 @4xl:grid-cols-2 @4xl:items-start" aria-hidden="true">
          <Card>
            <CardContent className="flex flex-col items-center gap-4">
              <Skeleton className="aspect-square max-h-44 w-full max-w-72 sm:max-h-none" />
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
            </CardContent>
          </Card>
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="my-1 h-3 w-16" />
              <div className="flex flex-col gap-1 rounded-lg border bg-card p-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-13 w-full" />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="my-1 h-3 w-20" />
              <div className="flex flex-col rounded-lg border bg-card px-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex h-10.5 items-center justify-between border-b last:border-b-0">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
