import { Fragment } from "react";

import { Text } from "@/components/ui/typography";

import { LIVE_MODULES } from "./modules";

// Proof strip — quiet sentence on the left, the live modules on the right, so
// the strip doubles as a one-line product map.
export function LandingStats() {
  return (
    <section className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12 sm:flex-row sm:justify-between">
        <Text variant="muted">
          Built for people who think in systems, not in spreadsheets
        </Text>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-muted-foreground">
          {LIVE_MODULES.map((module, index) => (
            <Fragment key={module.href}>
              {index > 0 && <span aria-hidden>·</span>}
              <span>{module.name}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
