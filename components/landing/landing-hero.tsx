import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Hero — radial spotlight + grid background + faux product card under the
// copy. Same visual structure as trim-success, adapted to Allstars Galaxy
// copy and KPIs.
export function LandingHero() {
  return (
    <section className="relative overflow-hidden border-b border-neutral-200/80">
      {/* Soft radial spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(99,102,241,0.10) 0%, rgba(255,255,255,0) 70%)",
        }}
      />
      {/* Grid lines, masked to fade at the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pb-28 pt-24 text-center sm:pt-32">
        <Link
          href="#modules"
          className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-xs text-neutral-600 backdrop-blur transition-colors hover:border-neutral-300 hover:text-neutral-900"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
          Beta · six modules in one orbit
          <ArrowRight className="h-3 w-3" />
        </Link>

        <h1 className="mx-auto max-w-4xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Money and time,
          <br />
          in one orbit.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-neutral-500 sm:text-lg">
          Allstars Galaxy is the calm command center for your portfolio, your
          plans, your week and the trips you take along the way — built for
          people who compound.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-full bg-neutral-900 px-6 text-[14px] font-medium text-white transition hover:bg-neutral-800"
          >
            Get started
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
          <a
            href="#modules"
            className="inline-flex h-11 items-center justify-center rounded-full border border-neutral-200 bg-white px-6 text-[14px] font-medium text-neutral-900 transition hover:bg-neutral-50"
          >
            See the modules
          </a>
        </div>

        <p className="mt-6 text-xs text-neutral-400">
          Free during beta · No credit card · Your data stays yours
        </p>
      </div>

      {/* Faux product card — KPI tiles + a sparkline-ish bar chart, framed
          like a Mac window. Pure HTML/CSS, no image asset needed. */}
      <div className="relative mx-auto max-w-5xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-1 shadow-[0_30px_120px_-20px_rgba(80,80,160,0.18)]">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4">
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <span className="h-2 w-2 rounded-full bg-yellow-400" />
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="ml-3 font-mono text-neutral-500">
                  allstars-galaxy.app/portfolio
                </span>
              </div>
              <span className="hidden text-xs text-neutral-400 sm:inline">
                Net worth · YTD
              </span>
            </div>

            {/* KPIs mirror the real PortfolioStats fields surfaced on
                /portal/portfolio: totalValue, allTimeProfitPercentage,
                totalInvestmentMethods, activeTransactions. Numbers are
                illustrative; the labels match what the app actually shows. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: "Portfolio value", value: "$284,150", delta: "+12.4% all-time" },
                { label: "Methods in use", value: "5", delta: "DCA · Value · Dividend" },
                { label: "Transactions", value: "318", delta: "+9 this month" },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-lg border border-neutral-200 bg-white p-4"
                >
                  <div className="text-xs text-neutral-500">{kpi.label}</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">
                    {kpi.value}
                  </div>
                  <div className="mt-1 text-xs text-emerald-600">
                    {kpi.delta}
                  </div>
                </div>
              ))}
            </div>

            {/* Fake sparkline-ish bars */}
            <div className="mt-6 flex h-28 items-end gap-1.5">
              {[
                28, 36, 44, 40, 52, 48, 60, 56, 68, 64, 76, 72, 80, 76, 88, 84,
                96,
              ].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-gradient-to-t from-neutral-200 to-neutral-900/70"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
