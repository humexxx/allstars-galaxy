import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function LandingCta() {
  return (
    <section id="galaxy" className="bg-neutral-50">
      <div className="mx-auto w-full max-w-5xl px-5 py-28 text-center sm:px-8 lg:py-36">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Manifesto
        </p>
        <h2 className="mt-3 text-5xl font-bold leading-[1.05] tracking-[-0.02em] text-neutral-900 text-balance sm:text-6xl lg:text-7xl">
          Your finances orbit something bigger.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600 text-balance">
          Capital is the gravity. But your goals, your projects and your wellbeing are
          the planets that actually make the picture worth looking at.
        </p>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-full bg-neutral-900 px-7 text-base font-medium text-white transition hover:bg-neutral-800"
          >
            Start free
            <ArrowRight className="ml-1 size-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-full border border-neutral-300 px-7 text-base font-medium text-neutral-900 transition hover:bg-neutral-100"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </section>
  );
}
