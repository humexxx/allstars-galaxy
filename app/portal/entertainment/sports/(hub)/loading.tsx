import { SportSkeleton } from "@/components/entertainment/sports/sports-navigation"

/**
 * Mirrors the sports hub: no page header, one sport's shell, its name row
 * ending on the favourites and the sport picker.
 *
 * The status sits beside the skeleton, not in it: the hub draws the same
 * skeleton under a status of its own while it switches sport.
 */
export default function SportsLoading(): React.ReactElement {
  return (
    <>
      <span role="status" className="sr-only">
        Loading sports…
      </span>
      <SportSkeleton />
    </>
  )
}
