import { Skeleton } from "@/components/ui/skeleton"

export default function ComparePlansLoading() {
  return (
    <section className="space-y-6" aria-hidden="true">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-96 w-full" />
    </section>
  )
}
