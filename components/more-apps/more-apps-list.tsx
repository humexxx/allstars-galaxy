"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronRight, EyeOff } from "lucide-react";

import { AppCard } from "@/components/more-apps/app-card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import type { AppListing } from "@/types/apps";

const STORAGE_KEY = "more-apps:hidden";

// Apps hidden on the very first visit. After that, the user's choices
// (stored in localStorage) take over — they can unhide these from the
// "Hidden apps" section. We only fall back to this list while
// localStorage is empty (i.e. the user has never interacted with the
// hide/show controls). Adding new entries here will NOT retroactively
// hide them for users whose localStorage is already populated.
const DEFAULT_HIDDEN = ["nbxe-admin-panel"];

const EMPTY_SET = new Set<string>();

// Module-level cache so `getSnapshot` returns a stable reference across
// renders — required by `useSyncExternalStore` to avoid infinite loops.
// Invalidated on writes and on cross-tab `storage` events.
let cachedSnapshot: Set<string> | null = null;

function getSnapshot(): Set<string> {
  if (cachedSnapshot !== null) return cachedSnapshot;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    cachedSnapshot = new Set(DEFAULT_HIDDEN);
    return cachedSnapshot;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    cachedSnapshot = new Set(
      Array.isArray(parsed) ? (parsed as string[]) : []
    );
  } catch {
    cachedSnapshot = new Set();
  }
  return cachedSnapshot;
}

function getServerSnapshot(): Set<string> {
  return EMPTY_SET;
}

function subscribe(callback: () => void): () => void {
  const handler = (): void => {
    cachedSnapshot = null;
    callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function persist(next: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  cachedSnapshot = next;
  // The native `storage` event only fires in OTHER tabs, so dispatch
  // manually to update any subscriber in the same tab.
  window.dispatchEvent(new Event("storage"));
}

export type AppWithScreenshot = {
  app: AppListing;
  screenshotUrl: string | null;
};

export function MoreAppsList({ items }: { items: AppWithScreenshot[] }) {
  const hidden = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const [showHidden, setShowHidden] = useState(false);

  const hide = (slug: string) => {
    const next = new Set(hidden);
    next.add(slug);
    persist(next);
  };

  const show = (slug: string) => {
    const next = new Set(hidden);
    next.delete(slug);
    persist(next);
  };

  const visible = items.filter(({ app }) => !hidden.has(app.slug));
  const hiddenList = items.filter(({ app }) => hidden.has(app.slug));

  return (
    // Columns by the room the list has, not the viewport: with the sidebar
    // open, `lg:grid-cols-3` made three 213px cards that clipped their own
    // badges.
    <div className="@container flex flex-col gap-6">
      {visible.length > 0 ? (
        <div className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
          {visible.map(({ app, screenshotUrl }) => (
            <AppCard
              key={app.slug}
              app={app}
              screenshotUrl={screenshotUrl}
              onHide={() => hide(app.slug)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={EyeOff}
          title="All apps are hidden"
          description="Expand the section below to unhide some."
        />
      )}

      {hiddenList.length > 0 && (
        <>
          <Separator />
          <Collapsible open={showHidden} onOpenChange={setShowHidden} className="flex flex-col gap-3">
            <CollapsibleTrigger className="group/hidden inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <ChevronRight className="size-4 transition-transform group-data-[state=open]/hidden:rotate-90" />
              Hidden apps ({hiddenList.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
              {hiddenList.map(({ app, screenshotUrl }) => (
                <AppCard
                  key={app.slug}
                  app={app}
                  screenshotUrl={screenshotUrl}
                  onShow={() => show(app.slug)}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}
