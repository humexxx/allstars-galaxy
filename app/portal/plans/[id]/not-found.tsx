import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Heading, Text } from "@/components/ui/typography"

export default function PlanNotFound() {
  return (
    <section className="flex min-h-[60svh] flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-2">
        <Heading level="h3" as="h1">Plan not found</Heading>
        <Text variant="muted">
          This finance plan doesn&apos;t exist or you don&apos;t have access to it.
        </Text>
      </div>
      <Button asChild>
        <Link href="/portal/plans">Back to plans</Link>
      </Button>
    </section>
  )
}
