/**
 * Single source of truth for the authenticated portal's navigation.
 *
 * The sidebar (`app-sidebar`), the header's horizontal nav (`app-header`) and
 * the ⌘K command menu (`command-menu`) all derive their items from `PORTAL_NAV`
 * so the three surfaces never drift apart. Topology mirrors the shadcn docs
 * site: a standalone "home" link at the top, then one labelled section per
 * product area.
 */

// The navigation's own alias for the account role. Aliased from the single
// definition rather than spelled out again — the two drifted the moment a
// third role appeared.
import type { UserRole } from "@/types/user";

export type Role = UserRole;

export type NavLeaf = {
  title: string;
  url: string;
  /** Renders disabled ("Coming soon") wherever it's shown. */
  disabled?: boolean;
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
    items: [{ title: "Dashboard", url: "/portal" }],
  },
  {
    label: "Finance",
    items: [
      { title: "Portfolio", url: "/portal/portfolio" },
      { title: "Plans", url: "/portal/plans" },
    ],
  },
  {
    label: "Productivity",
    items: [
      { title: "Board", url: "/portal/productivity/board" },
      { title: "Road Paths", url: "/portal/productivity/road-paths" },
    ],
  },
  {
    label: "Entertainment",
    items: [
      { title: "Travel Planner", url: "/portal/entertainment/travel-planner" },
      { title: "Sports", url: "/portal/entertainment/sports" },
    ],
  },
  {
    label: "Wellness",
    disabled: true,
    items: [{ title: "Coming soon", url: "#", disabled: true }],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      { title: "More apps", url: "/portal/more-apps" },
      { title: "Users", url: "/portal/admin/users" },
      { title: "Transactions", url: "/portal/admin/transactions" },
    ],
  },
];

function adminAllowed(role: Role | undefined, isImpersonating: boolean): boolean {
  return role === "admin" && !isImpersonating;
}

/**
 * The sections a given session may see — admin-only sections are dropped for
 * non-admins and while impersonating (so the active session never appears
 * privileged on someone else's behalf). Disabled sections are kept; consumers
 * decide whether to render them.
 */
export function visibleSections(
  role: Role | undefined,
  isImpersonating = false
): NavSection[] {
  return PORTAL_NAV.filter(
    (section) => !section.adminOnly || adminAllowed(role, isImpersonating)
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
