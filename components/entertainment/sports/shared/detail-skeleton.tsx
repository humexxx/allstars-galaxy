import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** The breadcrumbs, then a page header: eyebrow, title, the line under it. */
function HeaderSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-56 max-w-full" />
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
    </div>
  );
}

/**
 * A padel or tennis tournament's page while it loads (`loading.tsx`): the
 * header, the card of facts beside its poster, then the draw's columns, with
 * a status for a screen reader beside it.
 */
export function TournamentPageSkeleton(): React.ReactElement {
  return (
    <>
      <span role="status" className="sr-only">
        Loading tournament…
      </span>
      <div className="@container flex flex-col gap-6" aria-hidden="true">
        <HeaderSkeleton />
        <Card>
          <CardContent className="flex flex-col gap-4 @2xl:flex-row @2xl:gap-6">
            <Skeleton className="aspect-video @2xl:-my-6 @2xl:-ml-6 @2xl:aspect-auto @2xl:min-h-64 @2xl:w-2/5 @2xl:rounded-none" />
            <div className="flex flex-1 flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-64 max-w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-16" />
          <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * A race's page while it loads: the header, the circuit's card and the
 * weekend's timetable on the left, the results table on the right, with a
 * status for a screen reader beside it.
 */
export function RacePageSkeleton(): React.ReactElement {
  return (
    <>
      <span role="status" className="sr-only">
        Loading race…
      </span>
      <div className="@container flex flex-col gap-6" aria-hidden="true">
        <HeaderSkeleton />
        <div className="grid gap-6 @4xl:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Card>
              <CardContent className="flex items-center gap-4 @md:gap-6">
                <Skeleton className="size-24 shrink-0 @md:size-32" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </CardContent>
            </Card>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
