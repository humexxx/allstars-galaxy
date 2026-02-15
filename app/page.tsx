import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="flex w-full max-w-3xl flex-col items-center justify-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
          Capital Galaxy
        </h1>
        <p className="text-xl text-muted-foreground">
          Welcome to your capital management platform.
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/portal">Go to Portal</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
