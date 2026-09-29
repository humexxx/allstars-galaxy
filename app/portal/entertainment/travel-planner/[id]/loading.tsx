import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * A trip opens on a photo hero, not a `PageHeader`: the back link and view
 * switch above it, the banner (full bleed on a phone, 21/9 from `sm`), then
 * the itinerary beside the payments and gallery column.
 */
export default function TripDetailLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24 sm:w-44" />
      </div>
      <Skeleton className="-mx-4 h-72 rounded-none sm:mx-0 sm:h-auto sm:aspect-21/9 sm:rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[5fr_3fr]">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-28" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-1.5 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-28 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
