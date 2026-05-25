"use client";

import { Eye, EyeOff, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ProviderIcon } from "@/components/more-apps/provider-icon";
import {
  deriveConsoleUrl,
  type AppListing,
} from "@/app/portal/more-apps/apps-data";

// Deterministic per-app gradient — used when no screenshot is available.
const GRADIENT_BY_SLUG: Record<string, string> = {
  "cv-galaxy": "from-sky-500 to-cyan-500",
  "padel-galaxy": "from-emerald-500 to-teal-500",
  "trim-success": "from-orange-500 to-rose-500",
  lixcore: "from-violet-500 to-purple-500",
};

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
  const isLive = app.status === "live" && Boolean(app.url);
  const gradient =
    GRADIENT_BY_SLUG[app.slug] ?? "from-slate-500 to-slate-700";
  const domain = getHostname(app.url);
  const consoleUrl = deriveConsoleUrl(app);

  // Screenshot + body + footer share the same "open the app" anchor.
  // The provider header lives OUTSIDE that anchor so it can have its
  // own link to the console (no nested anchors).
  const mainContent = (
    <>
      {/* Screenshot */}
      <div className="aspect-video w-full bg-muted relative">
        {screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={screenshotUrl}
            alt={`${app.name} preview`}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br flex items-center justify-center text-6xl font-bold text-white/90 select-none",
              gradient
            )}
            aria-hidden="true"
          >
            {app.name.charAt(0)}
          </div>
        )}

        {/* Hide/show overlay button. Inside the screenshot but outside
            the anchor of the parent — we use preventDefault to be safe. */}
        {(onHide || onShow) && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onHide?.();
              onShow?.();
            }}
            className={cn(
              "absolute top-2 right-2 inline-flex items-center justify-center size-7 rounded-md bg-background/80 text-foreground backdrop-blur-sm shadow-sm transition-opacity ring-1 ring-foreground/10 hover:bg-background",
              onHide && "opacity-0 group-hover/card:opacity-100 focus:opacity-100"
            )}
            aria-label={onShow ? `Unhide ${app.name}` : `Hide ${app.name}`}
            title={onShow ? "Unhide" : "Hide"}
          >
            {onShow ? (
              <Eye className="size-3.5" />
            ) : (
              <EyeOff className="size-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-1">
        <h3 className="font-medium text-base leading-tight truncate">
          {app.name}
        </h3>
        <p className="text-xs text-muted-foreground truncate font-mono">
          {domain || "Not deployed"}
        </p>
      </div>

      {/* Footer: status + open icon */}
      <div className="border-t px-5 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full",
              isLive ? "bg-emerald-500" : "bg-muted-foreground/40"
            )}
            aria-hidden="true"
          />
          <span>{isLive ? "Live" : "Coming soon"}</span>
          {app.updatedAt && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Updated{" "}
                {formatDistanceToNow(new Date(app.updatedAt), {
                  addSuffix: true,
                })}
              </span>
            </>
          )}
        </div>
        {isLive && (
          <ExternalLink className="size-3 text-muted-foreground transition-colors group-hover/card:text-foreground" />
        )}
      </div>
    </>
  );

  return (
    <Card
      className={cn(
        "p-0 gap-0 overflow-hidden group/card transition-all relative",
        isLive && "hover:ring-foreground/25 hover:shadow-md",
        !isLive && "opacity-60",
        onShow && "opacity-60"
      )}
    >
      {/* Provider header */}
      <div className="px-4 py-2 flex items-center justify-between border-b text-xs">
        <div className="flex items-center gap-1.5">
          <ProviderIcon provider={app.provider} className="size-3 shrink-0" />
          <span className="font-medium">{PROVIDER_LABEL[app.provider]}</span>
        </div>
        {consoleUrl && (
          <a
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 transition-opacity inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            // Stop the click from bubbling so it doesn't also open the
            // app's main URL when the header is layered above it.
            onClick={(e) => e.stopPropagation()}
          >
            {PROVIDER_CONSOLE_LABEL[app.provider]}
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      {/* Main: clickable anchor opens the deployed app */}
      {isLive ? (
        <a
          href={app.url!}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {mainContent}
        </a>
      ) : (
        mainContent
      )}
    </Card>
  );
}
