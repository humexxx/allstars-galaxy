import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";

/** How many weeks (Monday first) this month touches: four to six. */
function weeksThisMonth(now: Date): number {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Math.ceil((lead + days) / 7);
}

/**
 * The journal's silhouette, the plan's shape: the compact header, then the
 * screen-tall panel (the balance with its two lines, the view switcher over
 * the month picker, a month of days) beside the column of month figures and
 * the picked day. Below `xl` the calendar is as tall as its weeks, so it draws
 * this month's count; the small lines are 14px, 16px on a phone, where the
 * first of the two wraps and the switchers are 40px and 36px.
 */
export default function TradingJournalLoading(): React.ReactElement {
  const weeks = weeksThisMonth(new Date());
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
              <div className="flex min-w-0 flex-col gap-1">
                <Skeleton className="h-3.5 w-28 max-sm:h-4" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-36 sm:h-10 sm:w-44" />
                  <Skeleton className="h-5 w-36 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-66 max-w-full max-sm:h-8" />
                <Skeleton className="h-3.5 w-56 max-sm:h-4" />
              </div>
              <div className="flex flex-col gap-2 max-sm:w-full sm:items-end">
                <Skeleton className="h-10 w-28 sm:h-8 sm:w-66" />
                <Skeleton className="h-9 w-full sm:h-8 sm:w-70" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 xl:min-h-0 xl:flex-1">
            <Skeleton className="h-6 w-full sm:h-5.5" />
            {Array.from({ length: weeks }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full sm:h-20 xl:h-auto xl:flex-1" />
            ))}
          </CardContent>
        </Card>
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2 xl:flex xl:h-[max(40rem,calc(100svh-11.5rem))] xl:flex-col xl:items-stretch">
          <Skeleton className="h-59 rounded-xl sm:h-58.5" />
          <Skeleton className="h-23 rounded-xl sm:h-22.5 xl:h-auto xl:flex-1" />
        </div>
      </div>
    </section>
  );
}
