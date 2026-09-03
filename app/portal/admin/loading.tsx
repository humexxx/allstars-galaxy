import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"

export default function AdminLoading() {
  return (
    <section className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton descriptionWidth="w-64" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </section>
  )
}
