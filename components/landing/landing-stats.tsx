import { Fragment } from "react";

import { Text } from "@/components/ui/typography";

import { LIVE_MODULES } from "./modules";

// Proof strip — a quiet sentence over the live modules, so the strip doubles
// as a one-line product map. The dots only show where the modules fit on one
// line: on a wrapped row one of them ends a line or starts the next.
export function LandingStats() {
  return (
    <section className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-12 text-center">
        <Text variant="muted">
          Built for people who think in systems, not in spreadsheets
        </Text>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-muted-foreground">
          {LIVE_MODULES.map((module, index) => (
            <Fragment key={module.href}>
              {index > 0 && (
                <span aria-hidden className="hidden lg:inline">
                  ·
                </span>
              )}
              <span>{module.name}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
