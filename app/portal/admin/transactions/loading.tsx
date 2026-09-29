import { Skeleton } from "@/components/ui/skeleton"
import { AdminTableSkeleton } from "@/components/admin/admin-table-skeleton"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"

/** The approvals queue: header, the three filter fields, then the table. */
export default function AdminTransactionsLoading() {
  return (
    <section className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton descriptionWidth="w-96" />
      <div className="flex flex-col items-end gap-4 sm:flex-row">
        {["sm:w-72", "sm:w-50", "sm:w-50"].map((width, i) => (
          <div key={i} className={`flex w-full flex-col gap-2 ${width}`}>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <AdminTableSkeleton />
    </section>
  )
}
