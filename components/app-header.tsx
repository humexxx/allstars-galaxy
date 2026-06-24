"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { UserCog, X } from "lucide-react";
import { User } from "@supabase/supabase-js";

import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { CommandMenu } from "@/components/command-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NavUser } from "./nav-user";
import { stopImpersonationAction } from "@/app/actions/impersonation";
import {
  headerNav,
  isHeaderItemActive,
  type Role,
} from "@/components/portal/nav-config";
import { cn } from "@/lib/utils";

type ImpersonatedUser = {
  id: string;
  email: string | null;
  fullName: string | null;
};

type AppHeaderProps = {
  realUser: User;
  impersonatedUser: ImpersonatedUser | null;
  /** Effective role from the server context (DB-backed). Drives whether the
   *  Admin link surfaces in the horizontal nav. */
  role?: Role;
  isImpersonating?: boolean;
};

// Header height is 56px (`h-14`). The sidebar offsets itself by the same
// amount via `top-14 h-[calc(100svh-3.5rem)]` in app-sidebar.tsx — keep them
// in sync if you adjust this.
export function AppHeader({
  realUser,
  impersonatedUser,
  role,
  isImpersonating: isImpersonatingProp,
}: AppHeaderProps) {
  const [isStopping, startStop] = useTransition();
  const isImpersonating = isImpersonatingProp ?? impersonatedUser !== null;
  const pathname = usePathname();

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

  const navItems = headerNav(role, isImpersonating);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 px-3 sm:gap-4 sm:px-6",
        // Frosted bar like the shadcn docs site — flat, no bottom divider, with
        // a solid fallback where backdrop-filter isn't supported. The only time
        // we frame it is while impersonating, to keep that state obvious.
        isImpersonating
          ? "border-b border-amber-500/40 bg-amber-100/70 dark:bg-amber-500/15"
          : "bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur"
      )}
    >
      {/* Trigger only on mobile — it opens the sidebar sheet. On desktop the
          sidebar is always visible (like the shadcn docs), so no collapse
          control is shown. */}
      <SidebarTrigger className="shrink-0 md:hidden" />

      {/* Brand: compact mark + wordmark, the first inline element of one flat
          strip (no separators, no "zone" wrapper) — matches shadcn's header. */}
      <Link
        href="/portal"
        aria-label="Allstars Galaxy"
        className="flex shrink-0 items-center gap-2 rounded-md transition-opacity hover:opacity-80"
      >
        <Logo className="size-5" />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">
          Allstars Galaxy
        </span>
      </Link>

      {/* Top-level section nav — flat text links (no pills), mirroring the
          sidebar groups for quick jumps. Hidden below md so small screens
          rely on the sidebar (opened via the trigger). */}
      <nav className="hidden items-center gap-4 text-sm md:flex lg:gap-6">
        {navItems.map((item) => {
          const active = isHeaderItemActive(pathname, item);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "font-medium transition-colors hover:text-foreground",
                active ? "text-foreground" : "text-foreground/70"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Flexible spacer pushes utilities to the far right; the impersonation
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
        <CommandMenu role={role} isImpersonating={isImpersonating} />
        <ModeToggle />
        <NavUser user={userData} />
      </div>
    </header>
  );
}
