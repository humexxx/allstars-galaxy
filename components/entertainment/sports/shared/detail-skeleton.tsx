import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { ShellHeadSkeleton } from "../sports-navigation";

/**
 * A padel or tennis tournament's page while it loads (`loading.tsx`): laid
 * out as the page is, the sport's name row with the breadcrumb's longer
 * title and the tabs, then the Bracket it opens on: the draw's columns. A
 * status for a screen reader beside it.
 */
export function TournamentPageSkeleton(): React.ReactElement {
  return (
    <>
      <span role="status" className="sr-only">
        Loading tournament…
      </span>
      <div className="@container flex flex-col">
        <ShellHeadSkeleton title="w-72" />
        <div className="grid grid-cols-2 gap-3 pt-6 @2xl:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * A race's page while it loads (`loading.tsx`): laid out as the page is, F1's
 * name row with the breadcrumb's longer title and the tabs, then the
 * Overview it opens on: the circuit's card beside the weekend's timetable. A
 * status for a screen reader beside it.
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
              <Skeleton className="aspect-square w-full max-w-72" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
