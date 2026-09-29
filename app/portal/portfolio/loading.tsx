import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { PortalPageContainer } from "@/components/portal/page-container"

/**
 * Mirrors the real Portfolio silhouette: compact title + three header actions
 * (hide values, Export, Add transaction), the tab strip, then the KPI row and
 * the chart in that order.
 *
 * Keep the tab count, the action count and the KPI count in sync with
 * `components/portal/portfolio-client.tsx`.
 */
export default function PortfolioLoading() {
  return (
    <PortalPageContainer>
      <section className="flex flex-col gap-6" aria-hidden="true">
        <PageHeaderSkeleton size="compact" actions={3} descriptionWidth="w-80" />

        {/* Tab strip */}
        <Skeleton className="h-10 w-72 rounded-lg" />

        {/* Four KPI cards — the headline row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>

        {/* Chart */}
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-44" />
              </div>
              <Skeleton className="h-8 w-56 rounded-lg" />
            </div>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </section>
    </PortalPageContainer>
  )
}
