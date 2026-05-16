"use client";

import { useTransition } from "react";
import { UserCog, X } from "lucide-react";
import { User } from "@supabase/supabase-js";

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
};

export function AppHeader({ realUser, impersonatedUser }: AppHeaderProps) {
  const [isStopping, startStop] = useTransition();
  const isImpersonating = impersonatedUser !== null;

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

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 shrink-0 items-center border-b bg-background",
        isImpersonating &&
          "border-amber-500/40 bg-amber-100/60 dark:bg-amber-500/15"
      )}
    >
      <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="-ml-2 md:hidden">
            <SidebarTrigger />
          </div>
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

        <div className="flex items-center gap-2">
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
      </div>
    </header>
  );
}
