import Link from "next/link"
import { FileQuestionMark } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

export default function PlanNotFound() {
  return (
    <EmptyState
      variant="card"
      titleAs="h1"
      icon={FileQuestionMark}
      title="Plan not found"
      description="This finance plan doesn’t exist or you don’t have access to it."
      action={
        <Button asChild>
          <Link href="/portal/plans">Back to plans</Link>
        </Button>
      }
    />
  )
}
