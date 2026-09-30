import { Skeleton } from "@/components/ui/skeleton"
import { AdminTableSkeleton } from "@/components/admin/admin-table-skeleton"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"

/** The users list: header, filter box, then the table on its card. */
export default function AdminLoading() {
  return (
    <section className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton descriptionWidth="w-96" />
      <Skeleton className="h-10 w-full max-w-sm" />
      <AdminTableSkeleton />
    </section>
  )
}
