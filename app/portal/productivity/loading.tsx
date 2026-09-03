import { Skeleton } from "@/components/ui/skeleton"
import { PortalPageContainer } from "@/components/portal/page-container"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"

export default function ProductivityLoading() {
  return (
    <PortalPageContainer width="wide">
    <section className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton descriptionWidth="w-64" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </section>
    </PortalPageContainer>
  )
}
