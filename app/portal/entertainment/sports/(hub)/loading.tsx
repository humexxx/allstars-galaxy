import {
  SportSkeleton,
  SportStripSkeleton,
} from "@/components/entertainment/sports/sports-navigation"

/**
 * Mirrors the sports hub: no page header, the sport strip with the favourites
 * button at its end, then one sport's shell.
 */
export default function SportsLoading(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <SportStripSkeleton />
      <SportSkeleton />
    </div>
  )
}
