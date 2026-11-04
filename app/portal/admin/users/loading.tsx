import { Skeleton } from "@/components/ui/skeleton"
import { AdminTableSkeleton } from "@/components/admin/admin-table-skeleton"

/** The users list: filter box, then the table on its card. */
export default function AdminUsersLoading() {
  return (
    <section className="space-y-6" aria-hidden="true">
      <Skeleton className="h-10 w-full max-w-sm" />
      <AdminTableSkeleton />
    </section>
  )
}
