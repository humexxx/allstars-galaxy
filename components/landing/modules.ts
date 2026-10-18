import type { LucideIcon } from "lucide-react";
import {
  HeartPulse,
  Kanban,
  Plane,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";

export type LandingArea = "Finance" | "Productivity" | "Entertainment" | "Wellness";

export type LandingModule = {
  /** The portal nav section it lives under. */
  area: LandingArea;
  /** The portal nav's own name for it — what the strip and the footer show. */
  name: string;
  /** The card heading, which has room to say more than the nav does. */
  title: string;
  description: string;
  icon: LucideIcon;
} & ({ status: "live"; href: string } | { status: "soon" });

export type LiveLandingModule = Extract<LandingModule, { status: "live" }>;

/**
 * Every module the landing names. The strip, the module grid, the footer and
 * the counts in the copy all read from here. They used to be three
 * hand-written lists, and Sports shipped in the portal without reaching any of
 * them. `modules.test.ts` holds this list to the portal nav, so a page added
 * there fails CI until it has copy here.
 */
export const LANDING_MODULES: LandingModule[] = [
  {
    area: "Finance",
    name: "Portfolio",
    title: "Portfolio",
    description:
      "Every position priced from market data — value, cost basis and all-time return in one view. The investment methods you follow sit one tab over, and the full history exports to CSV.",
    icon: Wallet,
    status: "live",
    href: "/portal/portfolio",
  },
  {
    area: "Finance",
    name: "Plans",
    title: "Finance Plans",
    description:
      "Model income, expenses and debts, then confirm each month against what really happened — the chart keeps your real history apart from the forecast. Compare scenarios side by side.",
    icon: TrendingUp,
    status: "live",
    href: "/portal/plans",
  },
  {
    area: "Productivity",
    name: "Board",
    title: "Productivity Board",
    description:
      "Visual board for the week. Drag-and-drop columns and tasks; the layout you set is what loads next time.",
    icon: Kanban,
    status: "live",
    href: "/portal/productivity/board",
  },
  {
    area: "Productivity",
    name: "Road Paths",
    title: "Road Paths",
    description:
      "Track long-term goals across quarters and years — milestones, progress and the slow compounding that gets you there.",
    icon: Target,
    status: "live",
    href: "/portal/productivity/road-paths",
  },
  {
    area: "Entertainment",
    name: "Travel Planner",
    title: "Travel Planner",
    description:
      "Flights, cruises, stays and activities on one calendar you can drag to re-plan. Track who is going and who pays for what, then share a private link per traveller — QR code included.",
    icon: Plane,
    status: "live",
    href: "/portal/entertainment/travel-planner",
  },
  {
    area: "Entertainment",
    name: "Sports",
    title: "Sports",
    description:
      "Live scores, standings and brackets for F1, football and the World Cup, LoL, tennis, padel and the NBA. Pick the sports you follow and their highlights land on your dashboard.",
    icon: Trophy,
    status: "live",
    href: "/portal/entertainment/sports",
  },
  {
    area: "Wellness",
    name: "Wellness",
    title: "Wellness",
    description:
      "Sleep, energy and focus — the inputs behind every decision worth making. (Coming soon)",
    icon: HeartPulse,
    status: "soon",
  },
];

export const LIVE_MODULES: LiveLandingModule[] = LANDING_MODULES.filter(
  (module): module is LiveLandingModule => module.status === "live"
);

export const SOON_MODULES: LandingModule[] = LANDING_MODULES.filter(
  (module) => module.status === "soon"
);

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** The counts sit inside prose, so they read as words ("six", not "6"). */
export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}
