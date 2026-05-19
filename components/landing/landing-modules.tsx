import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

type ModuleItem = {
  title: string;
  description: string;
  href: string;
  image: string;
  status?: "live" | "soon";
};

const MODULES: ModuleItem[] = [
  {
    title: "Portfolio",
    description:
      "Track every account, asset and cash position in one consolidated view.",
    href: "/portal/portfolio",
    image: "/images/landing/module-portfolio.svg",
    status: "live",
  },
  {
    title: "Investment Methods",
    description:
      "Define your strategy once. DCA, value, dividend, real estate — your playbook.",
    href: "/portal/investment-methods",
    image: "/images/landing/module-methods.svg",
    status: "live",
  },
  {
    title: "Productivity",
    description:
      "A board for today, road paths for the year. Intentions turn into shipping.",
    href: "/portal/productivity/board",
    image: "/images/landing/module-productivity.svg",
    status: "live",
  },
  {
    title: "Wellness",
    description:
      "Sleep, energy, focus — the inputs behind every decision worth making.",
    href: "#",
    image: "/images/landing/module-wellness.svg",
    status: "soon",
  },
];

export function LandingModules() {
  return (
    <section id="modules" className="bg-white">
      <div className="mx-auto w-full max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Modules
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-neutral-900 text-balance sm:text-5xl">
            One galaxy. Many orbits.
          </h2>
          <p className="mt-4 text-lg text-neutral-600 text-balance">
            Each module is useful on its own — and they really shine when they talk to
            each other.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-2">
          {MODULES.map((m) => {
            const Container = m.status === "soon" ? "div" : Link;
            const containerProps =
              m.status === "soon"
                ? {}
                : { href: m.href };

            return (
              <Container
                key={m.title}
                {...(containerProps as { href: string })}
                className="group relative flex flex-col bg-white p-8 transition hover:bg-neutral-50"
              >
                <div className="relative aspect-[5/3] w-full overflow-hidden rounded-lg bg-neutral-100">
                  <Image src={m.image} alt={`${m.title} illustration`} fill className="object-contain p-4" />
                </div>
                <div className="mt-6 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-semibold tracking-tight text-neutral-900">
                        {m.title}
                      </h3>
                      {m.status === "soon" && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                          Soon
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                      {m.description}
                    </p>
                  </div>
                  {m.status !== "soon" && (
                    <ArrowUpRight className="size-5 shrink-0 text-neutral-400 transition group-hover:text-neutral-900" />
                  )}
                </div>
              </Container>
            );
          })}
        </div>
      </div>
    </section>
  );
}
