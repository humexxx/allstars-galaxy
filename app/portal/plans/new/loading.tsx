import { Skeleton } from "@/components/ui/skeleton"
import { FormSkeleton } from "@/components/skeletons/form-skeleton"

export default function NewPlanLoading() {
  return (
    <section className="space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <FormSkeleton rows={4} />
    </section>
  )
}
