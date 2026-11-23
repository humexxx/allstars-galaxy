/**
 * Single source of truth for the authenticated portal's navigation.
 *
 * The sidebar (`app-sidebar`), the header's horizontal nav (`app-header`) and
 * the ⌘K command menu (`command-menu`) all derive their items from `PORTAL_NAV`
 * so the three surfaces never drift apart. Topology mirrors the shadcn docs
 * site: a standalone "home" link at the top, then one labelled section per
 * product area.
 */

import {
  AppWindow,
  ArrowLeftRight,
  CandlestickChart,
  ChartSpline,
  Flame,
  Kanban,
  LayoutDashboard,
  PieChart,
  Plane,
  Route,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

import { moduleOfPath, type AppModule } from "@/lib/access/modules";
import type { UserRole } from "@/types/user";

export type NavLeaf = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Renders disabled ("Coming soon") wherever it's shown. */
  disabled?: boolean;
  /** Its module is turned off for this account: shown greyed out, never a link. */
  locked?: boolean;
};

export type NavSection = {
  /** Section heading. Undefined → standalone, ungrouped link (the dashboard). */
  label?: string;
  items: NavLeaf[];
  /** Whole section is a "Coming soon" placeholder. */
  disabled?: boolean;
  /** Section is only visible to admins (and hidden while impersonating). */
  adminOnly?: boolean;
};

export const PORTAL_NAV: NavSection[] = [
  {
    items: [{ title: "Dashboard", url: "/portal", icon: LayoutDashboard }],
  },
  {
    label: "Finance",
    items: [
      { title: "Plans", url: "/portal/plans", icon: ChartSpline },
      { title: "Portfolio", url: "/portal/portfolio", icon: PieChart },
      { title: "Trading Journal", url: "/portal/trading", icon: CandlestickChart },
    ],
  },
  {
    label: "Productivity",
    items: [
      { title: "Board", url: "/portal/productivity/board", icon: Kanban },
      { title: "Road Paths", url: "/portal/productivity/road-paths", icon: Route },
    ],
  },
  {
    label: "Entertainment",
    items: [
      { title: "Travel Planner", url: "/portal/entertainment/travel-planner", icon: Plane },
      { title: "Sports", url: "/portal/entertainment/sports", icon: Trophy },
    ],
  },
  {
    label: "Wellness",
    items: [{ title: "Calories", url: "/portal/wellness/calories", icon: Flame }],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      { title: "More apps", url: "/portal/more-apps", icon: AppWindow },
      { title: "Users", url: "/portal/admin/users", icon: Users },
      { title: "Transactions", url: "/portal/admin/transactions", icon: ArrowLeftRight },
    ],
  },
];

function adminAllowed(role: UserRole | undefined, isImpersonating: boolean): boolean {
  return role === "admin" && !isImpersonating;
}

/**
 * The sections a given session may see — admin-only sections are dropped for
 * non-admins and while impersonating (so the active session never appears
 * privileged on someone else's behalf). Disabled sections are kept; consumers
 * decide whether to render them. A page whose module is off for the account
 * stays where it is, `disabled` and `locked`: the account sees it exists.
 */
export function visibleSections(
  role: UserRole | undefined,
  isImpersonating = false,
  disabledModules: readonly AppModule[] = []
): NavSection[] {
  return PORTAL_NAV.filter((section) => !section.adminOnly || adminAllowed(role, isImpersonating)).map(
    (section) => ({
      ...section,
      items: section.items.map((item) => {
        const owner = moduleOfPath(item.url);
        return owner && disabledModules.includes(owner) ? { ...item, disabled: true, locked: true } : item;
      }),
    })
  );
}

/**
 * Active state for a sidebar leaf link. The dashboard root matches exactly so it
 * doesn't light up on every sub-route; every other link also matches its
 * sub-routes — e.g. `/portal/plans` stays active on `/portal/plans/[id]`.
 */
export function isNavLeafActive(pathname: string, url: string): boolean {
  if (url === "/portal") return pathname === "/portal";
  return pathname === url || pathname.startsWith(`${url}/`);
}
