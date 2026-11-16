import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { PortalPageContainer } from "@/components/portal/page-container"

/**
 * Mirrors the real Portfolio silhouette: compact title + three header actions
 * (hide values, Export, Add transaction), the tab strip, then the KPI row and
 * the chart card in that order: its large figure over a note, the range
 * switch, the plot (taller from `sm`), and the legend line beside the price
 * status.
 *
 * The page is not known to be an owner's or an investor's until it loads, so
 * the KPI row draws what both share: an owner's two cards sit in the first two
 * of the investor's four columns, and only those two are drawn.
 *
 * Keep the tab count, the action count and the KPI columns in sync with
 * `components/portal/portfolio-client.tsx`.
 */
export default function PortfolioLoading() {
  return (
    <PortalPageContainer>
      <section className="flex flex-col gap-6" aria-hidden="true">
        <PageHeaderSkeleton size="compact" actions={3} description={false} />

        {/* Tab strip */}
        <Skeleton className="h-10 w-72 rounded-lg" />

        {/* KPI cards — the first two of a row of four */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl sm:h-29" />
          ))}
        </div>

        {/* Chart */}
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-56 sm:h-10" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-10 w-64 rounded-lg sm:h-8" />
            </div>
            <Skeleton className="h-64 w-full sm:h-80" />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <Skeleton className="h-8 w-full sm:h-3.5 sm:w-96" />
              <Skeleton className="h-6 w-72" />
            </div>
          </CardContent>
        </Card>
      </section>
    </PortalPageContainer>
  )
}
