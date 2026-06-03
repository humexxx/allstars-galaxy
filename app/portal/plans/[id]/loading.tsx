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
        {/* Header row mirrors PlanEditor: on mobile the compact 88px gauge
            pins to the title's top-right; from `sm` up the left column shrinks
            and the full 110px gauge anchors the far-right column. */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 flex-1 space-y-7 sm:flex-none">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-96 max-w-full" />
                {/* "Current period · …" line (period-mode plans) */}
                <Skeleton className="h-3 w-40" />
              </div>
              {/* Compact mobile gauge (88×88), hidden from `sm` up. */}
              <Skeleton className="h-[88px] w-[88px] shrink-0 rounded-full sm:hidden" />
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
          {/* Desktop gauge (110×110), hidden on mobile where the compact one
              above takes its place. */}
          <Skeleton className="hidden h-[110px] w-[110px] rounded-full sm:block" />
        </div>

        {/* 4 KPI cards: a horizontal-scroll rail on mobile (each ~44% wide so
            the third peeks in), a 2- then 4-column grid from `sm` up. Matches
            the real Overview rail so the swap doesn't shift. */}
        <div className="-m-1 flex gap-3 overflow-x-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:m-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:p-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
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
 * Mirrors the compact `SummaryCard` (size="sm") used in the Overview rail: an
 * uppercase label, a hero number, and a sublabel — no chevron (the breakdown
 * now opens in a sheet). On mobile the wrapper is ~44% wide and non-shrinking
 * so the cards line up with the real horizontal rail; from `sm` up it fills
 * its grid cell.
 */
function SummaryCardSkeleton() {
  return (
    <div className="w-[44%] shrink-0 sm:w-auto">
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="px-4 pt-4 pb-1">
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="space-y-1 px-4 pb-4">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-32 max-w-full" />
        </div>
      </div>
    </div>
  );
}
