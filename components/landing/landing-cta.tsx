import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Eyebrow, Heading, Text } from "@/components/ui/typography";

// Closing CTA — soft radial gradient anchored at the bottom, same shape as
// trim-success's "Empieza a ver tu inventario claro" section.
export function LandingCta() {
  return (
    <section
      id="galaxy"
      className="relative overflow-hidden border-b bg-background"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 100%, rgba(99,102,241,0.10) 0%, rgba(255,255,255,0) 70%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-6 py-28 text-center">
        <Eyebrow>Manifesto</Eyebrow>
        <Heading level="h2" className="mt-3">
          Your finances orbit something bigger.
        </Heading>
        <Text variant="muted" className="mt-4">
          Capital is the gravity. But your goals, your projects and your
          wellbeing are the planets that make the picture worth looking at.
        </Text>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition hover:bg-foreground/90"
          >
            Start free
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-full border bg-background px-6 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </section>
  );
}
