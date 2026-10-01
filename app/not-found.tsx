import type { Metadata } from "next"
import Link from "next/link"
import { Compass } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
}

/** App-wide 404 — Next's stock page rendered on white in another font. */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col bg-background">
      <EmptyState
        variant="card"
        titleAs="h1"
        icon={Compass}
        title="Page not found"
        description="The link may be broken, or the page may have moved."
        action={
          <>
            <Button asChild>
              <Link href="/portal">Go to your dashboard</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Back to the home page</Link>
            </Button>
          </>
        }
      />
    </main>
  )
}
