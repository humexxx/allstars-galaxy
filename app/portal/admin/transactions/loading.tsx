import { Skeleton } from "@/components/ui/skeleton"
import { AdminTableSkeleton } from "@/components/admin/admin-table-skeleton"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"

/** The approvals queue: header, the three filter fields, then the table. */
export default function AdminTransactionsLoading() {
  return (
    <section className="flex flex-col gap-6" aria-hidden="true">
      <PageHeaderSkeleton descriptionWidth="w-96" />
      {/* Same grid as the filters: the user picker spans the phone row, the
          two selects share the next one. */}
      <div className="grid grid-cols-2 items-end gap-4 sm:flex sm:flex-row">
        {["col-span-2 sm:w-72", "sm:w-50", "sm:w-50"].map((width, i) => (
          <div key={i} className={`flex min-w-0 flex-col gap-2 ${width}`}>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <AdminTableSkeleton />
    </section>
  )
}
