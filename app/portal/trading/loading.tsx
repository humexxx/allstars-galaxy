import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";

/**
 * The journal's silhouette, the plan's shape: the compact header, then the
 * screen-tall panel (the balance with its two lines, the view switcher over
 * the month picker, a month of days) beside the column of month figures and
 * the picked day.
 */
export default function TradingJournalLoading(): React.ReactElement {
  return (
    <section className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading the journal…
      </span>
      <PageHeaderSkeleton size="compact" actions={3} description={false} />
      <div className="grid gap-4 xl:grid-cols-4 xl:items-start">
        <Card className="min-w-0 xl:col-span-3 xl:h-[max(40rem,calc(100svh-11.5rem))]">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-28" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-48 sm:h-10 sm:w-56" />
                  <Skeleton className="h-5 w-32 rounded-full" />
                </div>
                <Skeleton className="h-3 w-72 max-w-full" />
                <Skeleton className="h-3 w-56" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <Skeleton className="h-8 w-72" />
                <Skeleton className="h-8 w-60" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 xl:min-h-0 xl:flex-1">
            <Skeleton className="h-6 w-full" />
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full sm:h-20 xl:h-auto xl:flex-1" />
            ))}
          </CardContent>
        </Card>
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2 xl:flex xl:h-[max(40rem,calc(100svh-11.5rem))] xl:flex-col xl:items-stretch">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl xl:h-auto xl:flex-1" />
        </div>
      </div>
    </section>
  );
}
