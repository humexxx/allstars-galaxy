import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Compass, HeartPulse, Kanban, Wallet } from "lucide-react";

const POINTS = [
  { icon: Wallet, title: "Net worth that adds up", desc: "Multi-currency, multi-account, no spreadsheets." },
  { icon: Compass, title: "Strategy you can follow", desc: "Codify your investment methods and stick to them." },
  { icon: Kanban, title: "Execution that ships", desc: "A board for the week, road paths for the year." },
  { icon: HeartPulse, title: "Wellness in the loop", desc: "The inputs behind every great decision. (Soon)" },
];

export function LandingSplit() {
  return (
    <section className="border-y border-neutral-200 bg-neutral-50">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:py-32">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Built for owners
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-neutral-900 text-balance sm:text-5xl lg:text-6xl">
            Money is just one variable in your life.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600 text-balance">
            Most apps treat your portfolio like an island. Allstars Galaxy treats it like
            part of an ecosystem — your goals, your week, your energy, all in the same orbit.
          </p>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-neutral-200 bg-white">
                  <p.icon className="size-4 text-neutral-700" />
                </span>
                <div>
                  <p className="font-semibold text-neutral-900">{p.title}</p>
                  <p className="mt-0.5 text-sm text-neutral-600">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-full bg-neutral-900 px-6 text-base font-medium text-white transition hover:bg-neutral-800"
            >
              Open my workspace
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-2">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src="/images/landing/hero-dashboard.svg"
                alt="Workspace preview"
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
