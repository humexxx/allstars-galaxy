import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function TripNotFound() {
  return (
    <section className="flex min-h-[60svh] flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Trip not found</h1>
        <p className="text-sm text-muted-foreground">
          This trip doesn&apos;t exist or you don&apos;t have access to it.
        </p>
      </div>
      <Button asChild>
        <Link href="/portal/entertainment/travel-planner">Back to trips</Link>
      </Button>
    </section>
  )
}
