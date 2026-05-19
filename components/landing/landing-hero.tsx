import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function LandingHero() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:py-28">
        <div className="lg:col-span-7">
          <h1 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-neutral-900 text-balance sm:text-6xl lg:text-7xl">
            Money and time,
            <br />
            in one orbit.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 text-balance lg:text-xl">
            Capital Galaxy is the calm command center for your finances, your week and the
            goals that connect them — built for people who compound.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-full bg-neutral-900 px-6 text-base font-medium text-white transition hover:bg-neutral-800"
            >
              Get started
              <ArrowRight className="ml-1 size-4" />
            </Link>
            <Link
              href="#how"
              className="inline-flex h-12 items-center justify-center rounded-full border border-neutral-300 px-6 text-base font-medium text-neutral-900 transition hover:bg-neutral-100"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-8 text-sm text-neutral-500">
            Free during beta · No credit card · Your data stays yours
          </p>
        </div>

        <div className="relative lg:col-span-5">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden rounded-2xl bg-neutral-100">
            <Image
              src="/images/landing/hero-dashboard.svg"
              alt="Capital Galaxy dashboard preview"
              fill
              priority
              className="object-contain p-6"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
