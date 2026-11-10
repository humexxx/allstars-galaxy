import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { PortalPageContainer } from "@/components/portal/page-container"

/**
 * Mirrors the real Portfolio silhouette: compact title + three header actions
 * (hide values, Export, Add transaction), the tab strip, then the KPI row and
 * the chart card in that order: its figure over a note, the range switch, the
 * plot (taller from `sm`), and the legend line beside the price status.
 *
 * Keep the tab count, the action count and the KPI count in sync with
 * `components/portal/portfolio-client.tsx`.
 */
export default function PortfolioLoading() {
  return (
    <PortalPageContainer>
      <section className="flex flex-col gap-6" aria-hidden="true">
        <PageHeaderSkeleton size="compact" actions={3} description={false} />

        {/* Tab strip */}
        <Skeleton className="h-10 w-72 rounded-lg" />

        {/* Four KPI cards — the headline row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl sm:h-29" />
          ))}
        </div>

        {/* Chart */}
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-44 sm:h-8" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-10 w-64 rounded-lg sm:h-8" />
            </div>
            <Skeleton className="h-64 w-full sm:h-80" />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <Skeleton className="h-7 w-full sm:h-3.5 sm:w-96" />
              <Skeleton className="h-6 w-72" />
            </div>
          </CardContent>
        </Card>
      </section>
    </PortalPageContainer>
  )
}
