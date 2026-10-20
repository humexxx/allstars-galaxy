import {
  DashboardFinanceSkeleton,
  DashboardSportsSkeleton,
  DashboardTravelSkeleton,
} from "@/components/portal/dashboard-card-skeleton"
import { PortalPageContainer } from "@/components/portal/page-container"

/**
 * The portal root's fallback is the dashboard's: the same grid, on the same
 * container query, holding a placeholder for each card — finance, travel,
 * then a row of sports — so the streamed cards land in the boxes the skeleton
 * drew. Sections with a different shape ship their own loading.tsx.
 */
export default function PortalLoading() {
  return (
    <PortalPageContainer>
      <section className="@container flex flex-col gap-6" aria-busy="true">
        <span className="sr-only" role="status">
          Loading…
        </span>
        <div className="grid auto-rows-min gap-4 @xl:grid-cols-2">
          <DashboardFinanceSkeleton />
          <DashboardTravelSkeleton />
          <DashboardSportsSkeleton />
        </div>
      </section>
    </PortalPageContainer>
  )
}
