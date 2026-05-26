import { Skeleton } from "@/components/ui/skeleton"

export default function PortfolioLoading() {
  return (
    <section className="space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-64 w-full" />
    </section>
  )
}
