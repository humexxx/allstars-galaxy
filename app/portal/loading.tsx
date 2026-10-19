import { DashboardCardSkeleton } from "@/components/portal/dashboard-card-skeleton"
import { PortalPageContainer } from "@/components/portal/page-container"

/**
 * The portal root's fallback is the dashboard's: the same two-column grid of
 * cards, so the streamed cards land in the boxes the skeleton drew.
 * Sections with a different shape ship their own loading.tsx.
 */
export default function PortalLoading() {
  return (
    <PortalPageContainer>
      <section className="flex flex-col gap-6" aria-busy="true">
        <span className="sr-only" role="status">
          Loading…
        </span>
        <div className="grid auto-rows-min gap-4 md:grid-cols-2">
          <DashboardCardSkeleton rail={5} />
          <DashboardCardSkeleton tiles={3} />
          <DashboardCardSkeleton tiles={3} />
          <DashboardCardSkeleton tiles={2} className="col-span-1" />
        </div>
      </section>
    </PortalPageContainer>
  )
}
