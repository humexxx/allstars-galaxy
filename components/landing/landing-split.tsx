import { Lock, ShieldCheck, Zap } from "lucide-react";

import { Heading } from "@/components/ui/typography";

// Feature bento — mirrors the "De Excel al cubo en 5 minutos" section in
// trim-success: 2/3 + 1/3 split with a primary feature on the left and a
// security pill on the right.
export function LandingSplit() {
  return (
    <section className="border-b border-neutral-200/80 bg-neutral-50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Speed
          </span>
          <Heading level="h2" className="mt-3 text-neutral-900">
            From scattered to systematic — in minutes.
          </Heading>
          <p className="mt-4 text-neutral-500">
            Connect your accounts, drop your goals, watch the orbit form. No
            setup ceremony, no consultants required.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-8 lg:col-span-2">
            <div className="mb-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
              <Zap className="h-3 w-3 text-emerald-500" />
              Compare
            </div>
            <Heading level="h3" className="text-neutral-900">
              Build plans. Compare scenarios side by side.
            </Heading>
            <p className="mt-3 max-w-lg text-sm text-neutral-500">
              Stack income, expenses, debts and projected net worth into a
              plan. Duplicate it, change one assumption, and open both at once
              on <span className="font-mono text-neutral-700">/plans/compare</span>.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-[10px] font-medium uppercase tracking-widest text-neutral-400">
                  Plan A
                </div>
                <div className="mt-1 font-mono text-sm text-neutral-700">
                  Save 25% · 7% return
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-full w-3/5 rounded-full bg-neutral-900" />
                </div>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-[10px] font-medium uppercase tracking-widest text-neutral-400">
                  Plan B
                </div>
                <div className="mt-1 font-mono text-sm text-neutral-700">
                  Save 35% · 6% return
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-full w-4/5 rounded-full bg-neutral-900" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-8">
            <div className="mb-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
              <Lock className="h-3 w-3" />
              Yours
            </div>
            <Heading level="h3" className="text-neutral-900">
              Your data, your workspace.
            </Heading>
            <p className="mt-3 text-sm text-neutral-500">
              Built on Supabase Auth + PostgreSQL. Every row is scoped to your
              user — services filter by ownership before they return a single
              number.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-neutral-500">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Row-level ownership, enforced server-side
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
