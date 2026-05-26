import { Flame, Globe } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AppProvider } from "@/app/portal/more-apps/apps-data";

/**
 * Small provider mark used on More Apps cards.
 * - Vercel: their iconic upward triangle, inline SVG to avoid an asset dep.
 * - Firebase: lucide's `Flame` — close enough to Firebase's flame mark.
 * - Other: globe fallback.
 */
export function ProviderIcon({
  provider,
  className,
}: {
  provider: AppProvider;
  className?: string;
}) {
  if (provider === "vercel") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cn("size-3", className)}
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2 L22 20 L2 20 Z" />
      </svg>
    );
  }
  if (provider === "firebase") {
    return (
      <Flame
        className={cn("size-3 text-orange-500", className)}
        aria-hidden="true"
      />
    );
  }
  return <Globe className={cn("size-3", className)} aria-hidden="true" />;
}
