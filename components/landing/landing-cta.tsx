import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Eyebrow, Heading, Text } from "@/components/ui/typography";

// Closing CTA — soft radial gradient anchored at the bottom, same shape as
// trim-success's "Empieza a ver tu inventario claro" section.
export function LandingCta({ signupsOpen }: { signupsOpen: boolean }) {
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
            "radial-gradient(50% 60% at 50% 100%, color-mix(in oklch, var(--primary) 14%, transparent) 0%, transparent 70%)",
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
            href={signupsOpen ? "/signup" : "/login"}
            className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition hover:bg-foreground/90"
          >
            {signupsOpen ? "Start free" : "Log in"}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
          {signupsOpen && (
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-full border bg-background px-6 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              I already have an account
            </Link>
          )}
        </div>
        {!signupsOpen && (
          <Text variant="small" className="mt-4">
            New accounts are closed during the private beta.
          </Text>
        )}
      </div>
    </section>
  );
}
