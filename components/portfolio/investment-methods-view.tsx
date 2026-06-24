"use client";

import { useMemo, useState } from "react";
import { EyeOff, Sparkles, TrendingUp, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useRegisterDevTool } from "@/components/dev-tools/dev-tools-context";

import type { InvestmentMethod } from "@/types/portfolio";

type InvestmentMethodsViewProps = {
  methods: InvestmentMethod[];
};

type RiskTone = "low" | "medium" | "high";

const RISK_BADGE: Record<RiskTone, { label: string; className: string }> = {
  low: {
    label: "Low risk",
    className:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  medium: {
    label: "Medium risk",
    className:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  high: {
    label: "High risk",
    className:
      "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  },
};

function normaliseRisk(level: string): RiskTone {
  const l = level.toLowerCase();
  if (l.startsWith("h")) return "high";
  if (l.startsWith("m")) return "medium";
  return "low";
}

export function InvestmentMethodsView({ methods }: InvestmentMethodsViewProps) {
  const [showDisabled, setShowDisabled] = useState(false);

  const showDisabledTool = useMemo(
    () => ({
      id: "investment-methods:show-disabled",
      kind: "toggle" as const,
      label: "Show disabled methods",
      description:
        "Reveal methods hidden from the portfolio selector (they only surface in plan auto-invest pickers).",
      section: "View",
      checked: showDisabled,
      onChange: setShowDisabled,
    }),
    [showDisabled]
  );
  useRegisterDevTool(showDisabledTool);

  const enabledMethods = useMemo(
    () => methods.filter((m) => m.enabled),
    [methods]
  );
  const visibleMethods = showDisabled ? methods : enabledMethods;

  const totals = useMemo(() => {
    const authors = new Set(enabledMethods.map((m) => m.author));
    const rois = enabledMethods.map((m) => parseFloat(m.monthlyRoi));
    const avgRoi =
      rois.length === 0
        ? 0
        : rois.reduce((sum, r) => sum + (Number.isFinite(r) ? r : 0), 0) /
          rois.length;
    const best = enabledMethods.reduce<
      { name: string; roi: number } | null
    >((acc, m) => {
      const r = parseFloat(m.monthlyRoi);
      if (!Number.isFinite(r)) return acc;
      if (!acc || r > acc.roi) return { name: m.name, roi: r };
      return acc;
    }, null);
    const byRisk = enabledMethods.reduce(
      (acc, m) => {
        acc[normaliseRisk(m.riskLevel)] += 1;
        return acc;
      },
      { low: 0, medium: 0, high: 0 } as Record<RiskTone, number>
    );
    const disabledCount = methods.length - enabledMethods.length;
    return {
      total: enabledMethods.length,
      authors: authors.size,
      avgRoi,
      best,
      byRisk,
      disabledCount,
    };
  }, [enabledMethods, methods.length]);

  const groupedMethods = useMemo(() => {
    const map = new Map<string, InvestmentMethod[]>();
    for (const m of visibleMethods) {
      const arr = map.get(m.author);
      if (arr) arr.push(m);
      else map.set(m.author, [m]);
    }
    return Array.from(map.entries())
      .map(([author, items]) => ({ author, items }))
      .sort((a, b) => a.author.localeCompare(b.author));
  }, [visibleMethods]);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Heading level="h3" className="font-semibold">
          Investment Methods
        </Heading>
        <Text variant="muted">
          Strategies available across the catalog — risk profile, monthly ROI
          and the author behind each vehicle.
        </Text>
      </div>

      {methods.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <Text variant="muted">No investment methods available yet.</Text>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Methods"
              value={String(totals.total)}
              sublabel={
                totals.disabledCount > 0
                  ? `${totals.disabledCount} disabled (hidden by default)`
                  : "All enabled in the catalog"
              }
            />
            <KpiCard
              label="Authors"
              value={String(totals.authors)}
              sublabel={`${totals.authors === 1 ? "1 strategist" : `${totals.authors} strategists`} contributing`}
              icon={Users}
            />
            <KpiCard
              label="Avg monthly ROI"
              value={`${totals.avgRoi.toFixed(2)}%`}
              tone="positive"
              sublabel="Across all enabled methods"
              icon={TrendingUp}
            />
            <KpiCard
              label="Best monthly ROI"
              value={
                totals.best ? `${totals.best.roi.toFixed(2)}%` : "—"
              }
              tone="positive"
              sublabel={totals.best?.name ?? "No methods yet"}
              icon={Sparkles}
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>Risk profile</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {totals.total} enabled
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RiskBar byRisk={totals.byRisk} total={totals.total} />
            </CardContent>
          </Card>

          {showDisabled && totals.disabledCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" /> Dev preview includes{" "}
              {totals.disabledCount} disabled method
              {totals.disabledCount === 1 ? "" : "s"}.
            </div>
          )}

          <div className="space-y-8">
            {groupedMethods.map(({ author, items }) => (
              <section key={author} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {author.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Heading level="h6" as="h2">{author}</Heading>
                      <Text variant="small">
                        {items.length}{" "}
                        {items.length === 1 ? "method" : "methods"}
                      </Text>
                    </div>
                  </div>
                  <Eyebrow>{`${items.length} of ${visibleMethods.length}`}</Eyebrow>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((method) => (
                    <MethodCard key={method.id} method={method} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sublabel?: React.ReactNode;
  tone?: "positive" | "negative";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      </CardHeader>
      <CardContent className="space-y-1">
        <Mono className={cn("block text-2xl font-semibold", toneClass(tone))}>
          {value}
        </Mono>
        {sublabel && (
          <Text variant="small" as="div">{sublabel}</Text>
        )}
      </CardContent>
    </Card>
  );
}

function MethodCard({ method }: { method: InvestmentMethod }) {
  const risk = normaliseRisk(method.riskLevel);
  const badge = RISK_BADGE[risk];
  const roi = parseFloat(method.monthlyRoi);
  return (
    <Card
      className={cn(
        "transition-shadow hover:shadow-md",
        !method.enabled && "opacity-60"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle>{method.name}</CardTitle>
            {method.description && (
              <Text variant="small" className="line-clamp-2">
                {method.description}
              </Text>
            )}
          </div>
          <Badge variant="outline" className={cn("shrink-0", badge.className)}>
            {badge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between border-t pt-3">
          <div className="space-y-0.5">
            <Eyebrow>Monthly ROI</Eyebrow>
            <Mono
              className={cn(
                "block text-2xl font-semibold",
                roi >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}
            >
              {Number.isFinite(roi) ? `${roi.toFixed(2)}%` : "—"}
            </Mono>
          </div>
          {!method.enabled && (
            <Badge variant="secondary" className="gap-1">
              <EyeOff className="h-3 w-3" /> Disabled
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RiskBar({
  byRisk,
  total,
}: {
  byRisk: Record<RiskTone, number>;
  total: number;
}) {
  if (total === 0) {
    return (
      <Text variant="small">No enabled methods to summarise.</Text>
    );
  }
  const segments: { tone: RiskTone; count: number }[] = [
    { tone: "low", count: byRisk.low },
    { tone: "medium", count: byRisk.medium },
    { tone: "high", count: byRisk.high },
  ];
  return (
    <div className="space-y-3">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {segments.map((seg) =>
          seg.count === 0 ? null : (
            <div
              key={seg.tone}
              className={cn("h-full", segmentColor(seg.tone))}
              style={{ width: `${(seg.count / total) * 100}%` }}
              aria-label={`${RISK_BADGE[seg.tone].label}: ${seg.count}`}
            />
          )
        )}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
        {segments.map((seg) => (
          <li key={seg.tone} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn("h-2 w-2 rounded-full", segmentColor(seg.tone))}
            />
            <Text variant="small" as="span">
              {RISK_BADGE[seg.tone].label}
            </Text>
            <Mono className="font-medium text-foreground">
              {seg.count}
            </Mono>
          </li>
        ))}
      </ul>
    </div>
  );
}

function segmentColor(tone: RiskTone): string {
  if (tone === "low") return "bg-emerald-500";
  if (tone === "medium") return "bg-amber-500";
  return "bg-rose-500";
}

function toneClass(tone?: "positive" | "negative"): string {
  if (tone === "positive") return "text-emerald-600 dark:text-emerald-400";
  if (tone === "negative") return "text-rose-600 dark:text-rose-400";
  return "";
}
