import { DashboardCardSkeleton } from "@/components/portal/dashboard-card-skeleton"
import { PortalPageContainer } from "@/components/portal/page-container"

/**
 * The dashboard's fallback: the same two-column grid of cards, so the streamed
 * cards land in the boxes the skeleton drew.
 *
 * It lives in the `(dashboard)` group, not at `app/portal/loading.tsx`. There
 * it wrapped every section too, and a section's own skeleton arrives a beat
 * after the first HTML chunk, so a reload of Plans or the Board flashed this
 * dashboard grid first. With no portal-wide fallback, the first paint is the
 * section's own `loading.tsx` — every section must ship one.
 */
export default function DashboardLoading() {
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
