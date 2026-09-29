"use client";

import { useState, type ReactNode } from "react";
import { Palette, Wallet, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { AppearanceSettings } from "@/components/settings/preferences-form";
import { FinanceSettings } from "@/components/settings/milestones-form";
import type { UserPreferences } from "@/types/preferences";
import { cn } from "@/lib/utils";

/**
 * Settings, grouped by the part of the app they affect — a System-Settings
 * shape (category rail on the left, one pane on the right) rendered in this
 * app's own vocabulary: shadcn Card, Geist, the standard border/muted tokens.
 *
 * Adding a category means adding one entry here plus its panel component; the
 * layout doesn't change.
 */
type Category = {
  id: string;
  label: string;
  /** One line under the pane title — what this group actually controls. */
  blurb: string;
  icon: LucideIcon;
  /** Tint for the icon chip. Apple leans on per-category colour here. */
  tint: string;
  render: (preferences: UserPreferences) => ReactNode;
};

const CATEGORIES: Category[] = [
  {
    id: "appearance",
    label: "Appearance",
    blurb: "How the portal looks and feels.",
    icon: Palette,
    tint: "bg-primary/10 text-primary",
    render: (p) => <AppearanceSettings preferences={p} />,
  },
  {
    id: "finance",
    label: "Finance",
    blurb: "Defaults for your plans and projection charts.",
    icon: Wallet,
    tint: "bg-success/10 text-success",
    render: (p) => <FinanceSettings milestones={p.financeMilestones} />,
  },
];

export function SettingsShell({ preferences }: { preferences: UserPreferences }) {
  const [activeId, setActiveId] = useState(CATEGORIES[0].id);

  return (
    // Real tabs: the rail switches a panel in place, it does not navigate, so
    // `aria-current="page"` was the wrong thing to say. A vertical rail from
    // sm up (System Settings); a horizontal scroll rail on phones, where a
    // fixed sidebar would eat half the screen.
    <Tabs
      value={activeId}
      onValueChange={setActiveId}
      orientation="vertical"
      className="flex-col gap-4 sm:flex-row sm:items-start sm:gap-6"
    >
      {/* `relative` is load-bearing on the scroller — see the responsive-ui
          skill. */}
      <TabsList
        aria-label="Settings categories"
        className="relative h-auto! w-full flex-row! justify-start gap-1.5 overflow-x-auto bg-transparent p-0 pb-1 sm:w-52 sm:shrink-0 sm:flex-col! sm:overflow-visible sm:pb-0"
      >
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <TabsTrigger
              key={c.id}
              value={c.id}
              className="h-auto w-auto! flex-none justify-start gap-2.5 rounded-lg px-2.5 py-2 text-left font-medium data-active:font-medium sm:w-full!"
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md",
                  c.tint
                )}
              >
                <Icon />
              </span>
              <span className="truncate">{c.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {CATEGORIES.map((c) => (
        <TabsContent key={c.id} value={c.id} className="w-full min-w-0 sm:flex-1">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{c.label}</CardTitle>
              <CardDescription>{c.blurb}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">{c.render(preferences)}</CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * One setting inside a pane: label + explanation on the left, its control on
 * the right. Rows are separated by hairlines rather than each being its own
 * card — the grouped-list look, and it keeps a pane readable as one block.
 */
export function SettingRow({
  label,
  description,
  control,
  children,
}: {
  label: string;
  description?: string;
  /** Right-aligned control (switch, button…). Omit for full-width settings. */
  control?: ReactNode;
  /** Content below the row — editors that need the full width. */
  children?: ReactNode;
}) {
  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Text weight="medium">{label}</Text>
          {description && <Text variant="small">{description}</Text>}
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
