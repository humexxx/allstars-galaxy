import Link from "next/link";
import {
  ArrowUpRight,
  Compass,
  HeartPulse,
  Kanban,
  Plane,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Eyebrow, Heading, Text } from "@/components/ui/typography";

type ModuleItem = {
  icon: typeof Wallet;
  title: string;
  description: string;
  href?: string;
  status?: "live" | "soon";
};

// MODULES — every live entry maps to a real page in app/portal/*. Copy lifted
// from each page's PageHeader / metadata so the landing doesn't drift from
// what the product actually does:
//   Portfolio          → app/portal/portfolio/page.tsx
//   Investment Methods → app/portal/investment-methods/page.tsx
//   Finance Plans      → app/portal/plans/page.tsx
//   Productivity Board → app/portal/productivity/board/page.tsx
//   Road Paths         → app/portal/productivity/road-paths/page.tsx
//   Travel Planner     → app/portal/entertainment/travel-planner/page.tsx
// Wellness is "Coming soon" in the sidebar, kept as a soft placeholder here.
const MODULES: ModuleItem[] = [
  {
    icon: Wallet,
    title: "Portfolio",
    description:
      "Total value, cost basis, all-time return and the full transactions log — one consolidated view of every account and asset.",
    href: "/portal/portfolio",
    status: "live",
  },
  {
    icon: Compass,
    title: "Investment Methods",
    description:
      "A catalogue of strategies grouped by author, each with its risk badge and expected returns. Reuse them inside your plans.",
    href: "/portal/investment-methods",
    status: "live",
  },
  {
    icon: TrendingUp,
    title: "Finance Plans",
    description:
      "Build scenarios for your income, expenses, debts and projected net worth — then compare them side by side.",
    href: "/portal/plans",
    status: "live",
  },
  {
    icon: Kanban,
    title: "Productivity Board",
    description:
      "Visual board for the week. Drag-and-drop columns and tasks; the layout you set is what loads next time.",
    href: "/portal/productivity/board",
    status: "live",
  },
  {
    icon: Target,
    title: "Road Paths",
    description:
      "Track long-term goals across quarters and years — milestones, progress and the slow compounding that gets you there.",
    href: "/portal/productivity/road-paths",
    status: "live",
  },
  {
    icon: Plane,
    title: "Travel Planner",
    description:
      "Plan upcoming trips, attach links and prices, share with a private link. Trips live in their own space, away from the numbers.",
    href: "/portal/entertainment/travel-planner",
    status: "live",
  },
  {
    icon: HeartPulse,
    title: "Wellness",
    description:
      "Sleep, energy and focus — the inputs behind every decision worth making. (Coming soon)",
    status: "soon",
  },
];

export function LandingModules() {
  return (
    <section id="modules" className="border-b bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Product</Eyebrow>
          <Heading level="h2" className="mt-3">
            One galaxy. Many orbits.
          </Heading>
          <Text variant="muted" className="mt-4">
            Six modules live today, one on the way. Each is useful on its own —
            and they really shine when they talk to each other.
          </Text>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ icon: Icon, title, description, href, status }) => {
            const isSoon = status === "soon";
            const body = (
              <div
                className={`group relative h-full bg-card p-6 transition-colors sm:p-8 ${
                  isSoon ? "" : "hover:bg-muted"
                }`}
              >
                <div className="mb-6 inline-flex h-9 w-9 items-center justify-center rounded-md border bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Heading
                      level="h4"
                      as="h3"
                      className="text-lg font-medium sm:text-lg"
                    >
                      {title}
                    </Heading>
                    {isSoon && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </div>
                  {!isSoon && (
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/50 transition group-hover:text-foreground" />
                  )}
                </div>
                <Text variant="muted" className="mt-2 leading-relaxed">
                  {description}
                </Text>
              </div>
            );

            if (isSoon || !href) {
              return (
                <div key={title} className="bg-card">
                  {body}
                </div>
              );
            }

            return (
              <Link key={title} href={href} className="bg-card">
                {body}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
