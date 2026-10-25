import { SportSkeleton } from "@/components/entertainment/sports/sports-navigation"

/**
 * Mirrors the sports hub: no page header, one sport's shell, its name row
 * ending on the favourites and the sport picker.
 */
export default function SportsLoading(): React.ReactElement {
  return <SportSkeleton />
}
