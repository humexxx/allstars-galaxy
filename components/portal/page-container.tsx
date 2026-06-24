"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type PortalPageContainerProps = {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
};

export function PortalPageContainer({
  children,
  className,
  fullWidth = false,
}: PortalPageContainerProps) {
  const pathname = usePathname();
  // The Finance plans surfaces use a Polymarket-style wide layout (giant chart
  // + side rail), so they breathe at a roomier max-width than the default
  // reading-width content pages.
  const wide = pathname?.startsWith("/portal/plans") ?? false;

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6 px-6 py-8 sm:px-8 lg:px-12",
        fullWidth ? "max-w-none" : wide ? "max-w-7xl" : "max-w-5xl",
        className
      )}
    >
      {children}
    </div>
  );
}
