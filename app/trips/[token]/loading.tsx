import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shared trip is the one page strangers land on cold, so the shell paints
 * before the trip resolves: the cover (full bleed on a phone, like the real
 * banner), then the itinerary card beside the aside column.
 */
export default function PublicTripLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
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
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
