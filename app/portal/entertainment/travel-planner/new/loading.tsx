import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TripFormSkeleton } from "@/components/travel/trip-form-skeleton"

/** Header, then the "Trip basics" card — without this the list's grid showed. */
export default function NewTripLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <PageHeaderSkeleton descriptionWidth="w-96" descriptionWraps />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-28 sm:h-7" />
        </CardHeader>
        <CardContent>
          <TripFormSkeleton />
        </CardContent>
      </Card>
    </div>
  )
}
