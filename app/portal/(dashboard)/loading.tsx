import { DashboardSportCardSkeleton } from "@/components/entertainment/sports/dashboard-sport-card-skeleton"
import { DashboardCardSkeleton } from "@/components/portal/dashboard-card-skeleton"
import { DASHBOARD_GRID, DASHBOARD_SECTION } from "@/components/portal/dashboard-layout"
import { PortalPageContainer } from "@/components/portal/page-container"

/**
 * The dashboard's fallback: exactly what `page.tsx` draws while its cards
 * stream — the same section, grid and card skeletons — so the page replaces it
 * without a single box moving.
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
      <section className={DASHBOARD_SECTION} aria-busy="true">
        <span className="sr-only" role="status">
          Loading…
        </span>
        <div className={DASHBOARD_GRID}>
          <DashboardCardSkeleton rail={5} />
          <DashboardCardSkeleton tiles={2} />
          <DashboardCardSkeleton trips />
          <DashboardSportCardSkeleton />
          <DashboardSportCardSkeleton />
        </div>
      </section>
    </PortalPageContainer>
  )
}
