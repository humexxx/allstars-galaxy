import Link from "next/link"
import { MapPinOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

export default function TripNotFound() {
  return (
    <EmptyState
      variant="card"
      titleAs="h1"
      icon={MapPinOff}
      title="Trip not found"
      description="This trip doesn't exist or you don't have access to it."
      action={
        <Button asChild>
          <Link href="/portal/entertainment/travel-planner">Back to trips</Link>
        </Button>
      }
    />
  )
}
