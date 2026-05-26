import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton that mirrors the PlanEditor silhouette (back button + header with
 * donut + 4 KPI cards + projection card). Keeping the same spacing
 * (`space-y-6`, `gap-4`, grid breakpoints) as the real layout makes the swap
 * to the rendered editor feel like content filling in rather than a layout
 * shift.
 */
export default function PlanDetailLoading() {
  return (
    <section className="space-y-4" aria-hidden="true">
      {/* Back-to-plans button */}
      <Skeleton className="h-8 w-32 -ml-2" />

      <div className="space-y-6">
        {/* Header row: title block + tabs on the left, donut on the right */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-7">
            <div className="space-y-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* TabsList: two visible triggers */}
              <div className="bg-muted/60 inline-flex h-9 items-center gap-1 rounded-md p-1">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-7 w-20" />
              </div>
              {/* "More" dropdown trigger */}
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
          {/* Financial-health donut (110×110) — render as a perfect circle so
              the loading shape matches the rendered gauge exactly. */}
          <Skeleton className="h-[110px] w-[110px] rounded-full" />
        </div>

        {/* 4 KPI summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SummaryCardSkeleton key={i} />
          ))}
        </div>

        {/* Projection panel: header (title + horizon presets) + chart + footer */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="space-y-1.5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
              {/* Horizon presets: 12 mo / 2 yr / 5 yr / 10 yr */}
              <div className="flex items-center gap-1">
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-14" />
              </div>
            </div>
            {/* Strategy badge row (collapsible, when debts exist) */}
            <div className="pt-2">
              <Skeleton className="h-9 w-full max-w-md" />
            </div>
          </div>
          <div className="p-6 pt-0 space-y-4">
            {/* Chart canvas — height matches the rendered Recharts container */}
            <Skeleton className="h-72 w-full" />
            {/* Footer KPIs that sit under the chart */}
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-md border p-3"
                >
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-28" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Mirrors the `SummaryCard` used in the Overview tab: a chevron-bearing
 * header, a hero number, and a sublabel. The values themselves are
 * intentionally short blocks so the skeleton reads as "card content
 * loading" rather than "page chrome loading".
 */
function SummaryCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between p-6 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4 rounded-sm" />
      </div>
      <div className="space-y-2 px-6 pb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-40 max-w-full" />
      </div>
    </div>
  );
}
