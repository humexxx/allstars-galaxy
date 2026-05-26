import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Closing CTA — soft radial gradient anchored at the bottom, same shape as
// trim-success's "Empieza a ver tu inventario claro" section.
export function LandingCta() {
  return (
    <section
      id="galaxy"
      className="relative overflow-hidden border-b border-neutral-200/80 bg-white"
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
        <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">
          Manifesto
        </span>
        <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Your finances orbit something bigger.
        </h2>
        <p className="mt-4 text-neutral-500">
          Capital is the gravity. But your goals, your projects and your
          wellbeing are the planets that make the picture worth looking at.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-full bg-neutral-900 px-6 text-[14px] font-medium text-white transition hover:bg-neutral-800"
          >
            Start free
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-full border border-neutral-200 bg-white px-6 text-[14px] font-medium text-neutral-900 transition hover:bg-neutral-50"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </section>
  );
}
