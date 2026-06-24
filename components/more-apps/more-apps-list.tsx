"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { AppCard } from "@/components/more-apps/app-card";
import { Text } from "@/components/ui/typography";
import type { AppListing } from "@/app/portal/more-apps/apps-data";

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
  const handler = () => {
    cachedSnapshot = null;
    callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function persist(next: Set<string>) {
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
    <div className="space-y-8">
      {visible.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <Text variant="muted">
          All apps are hidden. Expand the section below to unhide some.
        </Text>
      )}

      {hiddenList.length > 0 && (
        <div className="space-y-3 border-t pt-6">
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {showHidden ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            Hidden apps ({hiddenList.length})
          </button>
          {showHidden && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hiddenList.map(({ app, screenshotUrl }) => (
                <AppCard
                  key={app.slug}
                  app={app}
                  screenshotUrl={screenshotUrl}
                  onShow={() => show(app.slug)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
