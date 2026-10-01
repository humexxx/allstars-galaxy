"use client";

import {
  ArrowRight,
  ExternalLink,
  Eye,
  EyeOff,
  MoreHorizontal,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ProviderIcon } from "@/components/more-apps/provider-icon";
import { deriveConsoleUrl } from "@/app/portal/more-apps/apps-data";
import type { AppListing } from "@/types/apps";

// Deterministic per-app gradient — used when no screenshot is available.
// Placeholder art, so it borrows the chart palette rather than raw hues.
const GRADIENT_BY_SLUG: Record<string, string> = {
  "cv-galaxy": "from-chart-1 to-chart-3",
  "padel-galaxy": "from-chart-2 to-chart-4",
  "trim-success": "from-chart-3 to-chart-5",
  lixcore: "from-chart-4 to-chart-1",
};
const FALLBACK_GRADIENT = "from-muted-foreground to-foreground/70";

const PROVIDER_LABEL: Record<AppListing["provider"], string> = {
  vercel: "Vercel",
  firebase: "Firebase",
  other: "Other",
};

const PROVIDER_CONSOLE_LABEL: Record<AppListing["provider"], string> = {
  vercel: "Open in Vercel",
  firebase: "Open in Firebase",
  other: "Open console",
};

function getHostname(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function AppCard({
  app,
  screenshotUrl,
  onHide,
  onShow,
}: {
  app: AppListing;
  screenshotUrl: string | null;
  onHide?: () => void;
  onShow?: () => void;
}) {
  const liveUrl = app.status === "live" ? app.url : null;
  const isLive = Boolean(liveUrl);
  const gradient = GRADIENT_BY_SLUG[app.slug] ?? FALLBACK_GRADIENT;
  const domain = getHostname(app.url);
  const consoleUrl = deriveConsoleUrl(app);

  const description =
    app.description || (isLive ? "No description" : "Not yet deployed");

  // Treat the dropdown as the single home for secondary actions. Console
  // link, hide / unhide all live here — keeps the card header tidy and
  // mirrors the plans-workspace rail pattern (3-dots in the corner).
  const hasMenuItems = Boolean(consoleUrl) || Boolean(onHide) || Boolean(onShow);

  return (
    <Card
      className={cn(
        // `pt-0`: the cover is the card's top edge. Card only drops its top
        // padding for an <img> first child, so the gradient placeholder sat
        // under a 24px band of white.
        "flex flex-col pt-0 transition-shadow",
        isLive && "hover:ring-foreground/15 hover:shadow-md",
        (!isLive || onShow) && "opacity-60"
      )}
    >
      {/* Screenshot — kept as the visual hero so apps are recognisable at
          a glance. The Card primitive auto-rounds img:first-child, so the
          gradient placeholder mirrors that with rounded-t-xl manually. */}
      {screenshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={screenshotUrl}
          alt={`${app.name} preview`}
          className="aspect-5/2 w-full object-cover sm:aspect-video"
          loading="lazy"
        />
      ) : (
        <div
          aria-hidden="true"
          className={cn(
            // Shorter on a phone, where a 16:9 cover was taller than
            // everything the card had to say.
            "flex aspect-5/2 w-full items-center justify-center rounded-t-xl bg-gradient-to-br text-5xl font-bold text-background/90 select-none sm:aspect-video sm:text-6xl",
            gradient
          )}
        >
          {app.name.charAt(0)}
        </div>
      )}

      <CardHeader>
        <CardTitle as="h3" className="line-clamp-1">
          {app.name}
        </CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
        {hasMenuItems && (
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="-mr-2"
                  aria-label={`Actions for ${app.name}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {consoleUrl && (
                  <DropdownMenuItem asChild>
                    <a href={consoleUrl} target="_blank" rel="noopener noreferrer">
                      <ProviderIcon provider={app.provider} className="size-4" />
                      {PROVIDER_CONSOLE_LABEL[app.provider]}
                    </a>
                  </DropdownMenuItem>
                )}
                {consoleUrl && (onHide || onShow) && <DropdownMenuSeparator />}
                {onShow && (
                  <DropdownMenuItem onSelect={onShow}>
                    <Eye /> Unhide
                  </DropdownMenuItem>
                )}
                {onHide && (
                  <DropdownMenuItem onSelect={onHide}>
                    <EyeOff /> Hide
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <ProviderIcon provider={app.provider} />
            {PROVIDER_LABEL[app.provider]}
          </Badge>
          <Badge variant={isLive ? "success" : "outline"}>
            {isLive ? "Live" : "Coming soon"}
          </Badge>
          {app.updatedAt && (
            // Relative to "now", which the server and the browser read at
            // different moments — the minute can differ between the two.
            <Badge variant="outline" suppressHydrationWarning>
              Updated{" "}
              {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
            </Badge>
          )}
          {domain && (
            // A long host ran out of a narrow card instead of shortening.
            <Badge variant="outline" className="max-w-full font-mono" title={domain}>
              <span className="truncate">{domain}</span>
            </Badge>
          )}
        </div>

        <div className="mt-auto">
          {liveUrl ? (
            <Button variant="outline" className="w-full" asChild>
              <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                Open
                <ExternalLink />
              </a>
            </Button>
          ) : (
            <Button variant="outline" className="w-full" disabled>
              Coming soon
              <ArrowRight />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
