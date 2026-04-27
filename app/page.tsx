import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles, Wallet, Compass, Kanban, HeartPulse, ShieldCheck, BarChart3, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";

const MODULES: {
  title: string;
  description: string;
  href: string;
  image: string;
  status?: "live" | "soon";
  accent: string;
}[] = [
  {
    title: "Portfolio",
    description: "Track every account, asset and cash position in one consolidated view. See your true net worth update in real time.",
    href: "/portal/portfolio",
    image: "/images/landing/module-portfolio.svg",
    status: "live",
    accent: "from-cyan-50 to-sky-100 dark:from-cyan-950/40 dark:to-sky-950/30",
  },
  {
    title: "Investment Methods",
    description: "Define your strategy once. DCA, value, dividend, real estate — the playbook your future self will follow.",
    href: "/portal/investment-methods",
    image: "/images/landing/module-methods.svg",
    status: "live",
    accent: "from-amber-50 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/30",
  },
  {
    title: "Productivity",
    description: "A board for today and road paths for the long game. Turn intentions into a system that actually ships.",
    href: "/portal/productivity/board",
    image: "/images/landing/module-productivity.svg",
    status: "live",
    accent: "from-emerald-50 to-teal-100 dark:from-emerald-950/40 dark:to-teal-950/30",
  },
  {
    title: "Wellness",
    description: "Sleep, energy, focus. The inputs behind every good decision — measured next to the money they enable.",
    href: "#",
    image: "/images/landing/module-wellness.svg",
    status: "soon",
    accent: "from-violet-50 to-purple-100 dark:from-violet-950/40 dark:to-purple-950/30",
  },
];

const STEPS: { n: string; icon: React.ComponentType<{ className?: string }>; title: string; description: string }[] = [
  { n: "01", icon: Wallet, title: "Connect your world", description: "Add accounts, goals, methods and projects in minutes. Everything in one place — no more tab juggling." },
  { n: "02", icon: Target, title: "Define the system", description: "Set rules for how money moves, how time gets spent and what counts as progress this quarter." },
  { n: "03", icon: BarChart3, title: "Watch it compound", description: "Capital Galaxy quietly tracks the orbit. You make decisions; it shows you whether they're working." },
];

export default function LandingPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingNav />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 right-[-10%] size-[520px] rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-40 left-[-10%] size-[420px] rounded-full bg-amber-300/10 blur-3xl" />
        </div>
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:py-24 lg:px-8">
          <div className="lg:col-span-6">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5 text-primary" />
              Personal capital, mapped like a galaxy
            </span>
            <h1 className="mt-6 text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Manage your capital.
              <br />
              <span className="text-muted-foreground">Master your time.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Capital Galaxy is the calm command center for your money, your projects and the decisions that connect them — built for people who want to compound, not just consume.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-full bg-foreground px-6 text-base text-background hover:bg-foreground/90">
                <Link href="/signup">
                  Get started
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-6 text-base">
                <Link href="#how">See how it works</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" /> Private by default
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" /> No ads, ever
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-500" /> Free during beta
              </span>
            </div>
          </div>

          <div className="relative lg:col-span-6">
            <div className="relative mx-auto aspect-[720/560] w-full max-w-2xl">
              <Image
                src="/images/landing/hero-dashboard.svg"
                alt="Capital Galaxy dashboard preview"
                fill
                priority
                className="object-contain"
              />
            </div>
          </div>
        </div>

        {/* trusted strip */}
        <div className="border-y bg-muted/30">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-8 px-4 py-8 text-center sm:grid-cols-4 sm:px-6 lg:px-8">
            {[
              { kpi: "1 workspace", label: "Money + time" },
              { kpi: "5 modules", label: "Wired together" },
              { kpi: "0 ads", label: "Just your data" },
              { kpi: "100%", label: "You stay in control" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold tracking-tight">{s.kpi}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODULES (Google-style cards) */}
      <section id="modules" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mb-12 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Modules</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            One galaxy. Many orbits.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Each module is useful on its own — but they really shine when they talk to each other.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => {
            const Card = m.status === "soon" ? "div" : Link;
            return (
              <Card
                key={m.title}
                {...(m.status === "soon" ? {} : { href: m.href })}
                className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className={`relative aspect-[6/5] w-full bg-gradient-to-br ${m.accent}`}>
                  <Image src={m.image} alt={`${m.title} illustration`} fill className="object-contain p-4" />
                  {m.status === "soon" && (
                    <span className="absolute right-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                      Soon
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-xl font-semibold">{m.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{m.description}</p>
                  {m.status !== "soon" && (
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition group-hover:opacity-100">
                      Open module <ArrowRight className="size-4" />
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* SPLIT FEATURE (Uber-style dark) */}
      <section className="bg-foreground text-background">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Built for owners</p>
            <h2 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              Money is just one variable in your life.
            </h2>
            <p className="mt-4 text-lg text-background/70">
              Most apps treat your portfolio like an island. Capital Galaxy treats it like part of an ecosystem — your goals, your week, your energy, all in the same orbit.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                { icon: Wallet, title: "Net worth that adds up", desc: "Multi-currency, multi-account, no spreadsheets." },
                { icon: Compass, title: "Strategy you can follow", desc: "Codify your investment methods and stick to them." },
                { icon: Kanban, title: "Execution that ships", desc: "A board for the week, road paths for the year." },
                { icon: HeartPulse, title: "Wellness in the loop", desc: "The inputs behind every great decision. (Soon)" },
              ].map((item) => (
                <li key={item.title} className="flex gap-4">
                  <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-background/10">
                    <item.icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-background/60">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <Button asChild size="lg" className="h-12 rounded-full bg-background px-6 text-base text-foreground hover:bg-background/90">
                <Link href="/signup">
                  Open my workspace <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-amber-300/10 blur-2xl" />
            <div className="overflow-hidden rounded-2xl border border-background/10 bg-background/5 p-2 shadow-2xl">
              <div className="relative aspect-[720/560] w-full">
                <Image src="/images/landing/hero-dashboard.svg" alt="Workspace preview" fill className="object-contain" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (Google-style numbered) */}
      <section id="how" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">How it works</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            From scattered to systematic — in three moves.
          </h2>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-2xl border bg-card p-8 transition hover:shadow-md">
              <span className="text-sm font-mono font-semibold text-muted-foreground">{s.n}</span>
              <span className="mt-6 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-6" />
              </span>
              <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* GALAXY / WHY */}
      <section id="galaxy" className="relative overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900 text-white">
        <div className="absolute inset-0 -z-0 opacity-70">
          <Image src="/images/landing/galaxy.svg" alt="" fill className="object-cover" aria-hidden="true" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8 lg:py-32">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Why Galaxy</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            Your finances orbit something bigger.
          </h2>
          <p className="mt-6 text-lg text-white/70">
            Capital is the gravity. But your goals, your projects and your wellbeing are the planets that actually make the picture worth looking at. Capital Galaxy keeps them all in view.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full bg-white px-6 text-base text-slate-900 hover:bg-white/90">
              <Link href="/signup">
                Start free <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-white/30 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
