"use client";

import { ModeToggle } from "@/components/mode-toggle";

import { NavUser } from "./nav-user";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { User } from "@supabase/supabase-js";

export function AppHeader({ user }: { user: User }) {
  const userData = {
    name: user.user_metadata.full_name || user.email?.split("@")[0] || "User",
    email: user.email || "",
    avatar: user.user_metadata.avatar_url || "",
  };

  return (
    <header className="sticky top-0 flex h-16 shrink-0 items-center border-b bg-background">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="-ml-2">
            <SidebarTrigger />
          </div>
          <p className="text-xl font-bold">Capital Galaxy</p>
        </div>
        <div className="flex items-center gap-4">
          <ModeToggle />
          <NavUser user={userData} />
        </div>
      </div>
    </header>
  );
}

