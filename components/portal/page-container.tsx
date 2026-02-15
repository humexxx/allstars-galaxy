import type { ReactNode } from "react";

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
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8",
        fullWidth ? "max-w-none" : "max-w-screen-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}
