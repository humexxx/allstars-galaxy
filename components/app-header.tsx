"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { UserCog, X } from "lucide-react";
import { User } from "@supabase/supabase-js";

import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NavUser } from "./nav-user";
import { stopImpersonationAction } from "@/app/actions/impersonation";
import { cn } from "@/lib/utils";

type ImpersonatedUser = {
  id: string;
  email: string | null;
  fullName: string | null;
};

type AppHeaderProps = {
  realUser: User;
  impersonatedUser: ImpersonatedUser | null;
  /** Effective role from the server context (DB-backed). Drives whether
   *  the Admin link surfaces in the horizontal nav. */
  role?: "admin" | "user";
  isImpersonating?: boolean;
};

// Top-level horizontal nav, mirrors the shadcn docs header.
//
// `prefixes` is what we match against the current pathname to decide which
// link is active — the LINK href is just the user's destination on click.
// Listing prefixes explicitly avoids edge cases (e.g. /portal would match
// every sub-route under it).
const HEADER_NAV: Array<{
  label: string;
  href: string;
  prefixes: string[];
  adminOnly?: boolean;
}> = [
  { label: "Dashboard", href: "/portal", prefixes: ["/portal"] },
  {
    label: "Finance",
    href: "/portal/portfolio",
    prefixes: ["/portal/portfolio", "/portal/investment-methods", "/portal/plans"],
  },
  {
    label: "Productivity",
    href: "/portal/productivity/board",
    prefixes: ["/portal/productivity"],
  },
  {
    label: "Entertainment",
    href: "/portal/entertainment/travel-planner",
    prefixes: ["/portal/entertainment"],
  },
  {
    label: "Admin",
    href: "/portal/admin/users",
    prefixes: ["/portal/admin", "/portal/more-apps"],
    adminOnly: true,
  },
];

function isNavItemActive(pathname: string, prefixes: string[]): boolean {
  // The dashboard entry uses exact-match because its prefix "/portal"
  // would otherwise highlight on every route under the portal.
  if (prefixes.length === 1 && prefixes[0] === "/portal") {
    return pathname === "/portal";
  }
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Header height is 56px (`h-14`). The sidebar offsets itself by the same
// amount via `top-14 h-[calc(100svh-3.5rem)]` in app-sidebar.tsx — keep
// them in sync if you adjust this.
export function AppHeader({
  realUser,
  impersonatedUser,
  role,
  isImpersonating: isImpersonatingProp,
}: AppHeaderProps) {
  const [isStopping, startStop] = useTransition();
  const isImpersonating = isImpersonatingProp ?? impersonatedUser !== null;
  const pathname = usePathname();
  // Hide admin nav while impersonating so the active session can't appear
  // privileged on someone else's behalf — matches the sidebar's gating.
  const showAdminNav = role === "admin" && !isImpersonating;

  const userData = {
    name:
      realUser.user_metadata.full_name ||
      realUser.email?.split("@")[0] ||
      "User",
    email: realUser.email || "",
    avatar: realUser.user_metadata.avatar_url || "",
  };

  const impersonatedDisplayName =
    impersonatedUser?.fullName || impersonatedUser?.email || "user";

  const handleStop = () => {
    startStop(async () => {
      await stopImpersonationAction();
    });
  };

  const navItems = HEADER_NAV.filter((item) => !item.adminOnly || showAdminNav);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b bg-background px-3 sm:px-6",
        isImpersonating &&
          "border-amber-500/40 bg-amber-100/60 dark:bg-amber-500/15"
      )}
    >
      {/* Brand: compact logo + name on the far left, inline with the rest
          of the bar — no vertical separator, no "zone" wrapper. Matches
          shadcn's docs header where the mark is just the first inline
          element of one flat strip. */}
      <Link
        href="/portal"
        aria-label="Allstars Galaxy"
        className="flex shrink-0 items-center gap-2 rounded-md transition-colors hover:opacity-80"
      >
        <Logo className="size-5" />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">
          Allstars Galaxy
        </span>
      </Link>

      {/* Trigger collapses the sidebar — kept inline next to the brand
          like Linear / Vercel rather than tucked into the sidebar itself. */}
      <SidebarTrigger className="shrink-0" />

      {/* Horizontal section nav — mirrors the sidebar groups for quick
          jumps. Hidden below md so small screens fall back to the sidebar
          (opened via the trigger). */}
      <nav className="hidden items-center gap-1 md:flex">
        {navItems.map((item) => {
          const active = isNavItemActive(pathname, item.prefixes);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Flexible spacer pushes utilities to the far right; impersonation
          banner sits centred when active. */}
      <div className="flex flex-1 items-center justify-center gap-2">
        {isImpersonating && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-amber-500/60 bg-background/60 text-amber-700 dark:text-amber-200"
            >
              <UserCog className="mr-1 h-3 w-3" />
              Impersonating
            </Badge>
            <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {impersonatedDisplayName}
            </span>
            {impersonatedUser?.email && impersonatedUser?.fullName && (
              <span className="hidden text-xs text-amber-900/70 dark:text-amber-100/70 sm:inline">
                ({impersonatedUser.email})
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isImpersonating && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStop}
            disabled={isStopping}
            className="border-amber-500/60 bg-background/60 text-amber-900 hover:bg-amber-500/20 dark:text-amber-100"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            {isStopping ? "Stopping…" : "Stop impersonating"}
          </Button>
        )}
        <ModeToggle />
        <NavUser user={userData} />
      </div>
    </header>
  );
}
