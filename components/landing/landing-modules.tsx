import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Eyebrow, Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { LANDING_MODULES, LIVE_MODULES, SOON_MODULES, countWord } from "./modules";

/** Column span for the last card, keyed by card count mod 6 (the grid is 2
 *  columns from `sm` and 3 from `lg`), so the final row is always full. */
const LAST_ROW_SPAN: Record<number, string> = {
  0: "",
  1: "sm:col-span-2 lg:col-span-3",
  2: "lg:col-span-2",
  3: "sm:col-span-2 lg:col-span-1",
  4: "lg:col-span-3",
  5: "sm:col-span-2 lg:col-span-2",
};

function moduleCount(): string {
  const live = countWord(LIVE_MODULES.length);
  const soon = SOON_MODULES.length > 0 ? `, ${countWord(SOON_MODULES.length)} on the way` : "";
  return `${live.charAt(0).toUpperCase()}${live.slice(1)} modules live today${soon}.`;
}

export function LandingModules() {
  return (
    <section id="modules" className="border-b bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Product</Eyebrow>
          <Heading level="h2" className="mt-3">
            One galaxy. Many orbits.
          </Heading>
          <Text variant="muted" className="mt-4">
            {moduleCount()} Each is useful on its own — and they really shine
            when they talk to each other.
          </Text>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_MODULES.map((module, index) => {
            const { icon: Icon, title, description } = module;
            const isSoon = module.status === "soon";
            // The grid draws its dividers with `gap-px` over a border-coloured
            // background, so an unfilled last row showed up as a grey slab.
            // The last card stretches across whatever the row has left.
            const span =
              index === LANDING_MODULES.length - 1
                ? LAST_ROW_SPAN[LANDING_MODULES.length % 6]
                : "";
            const body = (
              <div
                className={`group relative h-full bg-card p-6 transition-colors sm:p-8 ${
                  isSoon ? "" : "hover:bg-muted"
                }`}
              >
                <div className="mb-6 inline-flex h-9 w-9 items-center justify-center rounded-md border bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Heading level="h4" as="h3">
                      {title}
                    </Heading>
                    {isSoon && (
                      <Badge variant="secondary">Soon</Badge>
                    )}
                  </div>
                  {!isSoon && (
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/50 transition group-hover:text-foreground" />
                  )}
                </div>
                <Text variant="muted" className="mt-2 leading-relaxed">
                  {description}
                </Text>
              </div>
            );

            if (module.status === "soon") {
              return (
                <div key={title} className={cn("bg-card", span)}>
                  {body}
                </div>
              );
            }

            return (
              <Link
                key={title}
                href={module.href}
                className={cn("bg-card outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", span)}
              >
                {body}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
