"use client";

import { useMemo, useState } from "react";
import { EyeOff, Layers, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { maskValue } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils/format";
import { formatRoi } from "./figures";
import { useRegisterDevTool } from "@/components/dev-tools/dev-tools-context";

import type { MethodAllocationSummary } from "@/types/margin";
import type { InvestmentMethod } from "@/types/portfolio";

export type MethodCapital = {
  methodId: string;
  /** Cash contributed, at face value. */
  invested: number;
  /** What those contributions are worth today under the promised return. */
  holding: number;
  investorCount: number;
};

type InvestmentMethodsViewProps = {
  methods: InvestmentMethod[];
  /** Ids of the methods this user runs. Only these are editable, and only
   *  these carry the internal allocation. */
  ownedMethodIds?: string[];
  /** Allocation per owned method — never populated for anyone else. */
  allocations?: MethodAllocationSummary[];
  onEditMethod?: (method: InvestmentMethod) => void;
  /** Money sitting in each method. Only supplied for methods you run — a
   *  client browsing the catalogue has no business seeing other people's
   *  capital. */
  capital?: MethodCapital[];
  hideValues?: boolean;
};

type RiskTone = "low" | "medium" | "high";

const RISK_BADGE: Record<
  RiskTone,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  low: { label: "Low risk", variant: "success" },
  medium: { label: "Medium risk", variant: "warning" },
  high: { label: "High risk", variant: "destructive" },
};

function normaliseRisk(level: string): RiskTone {
  const l = level.toLowerCase();
  if (l.startsWith("h")) return "high";
  if (l.startsWith("m")) return "medium";
  return "low";
}

export function InvestmentMethodsView({
  methods,
  ownedMethodIds = [],
  allocations = [],
  onEditMethod,
  capital = [],
  hideValues = false,
}: InvestmentMethodsViewProps) {
  const owned = useMemo(() => new Set(ownedMethodIds), [ownedMethodIds]);
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

  // Owners see every method THEY run, disabled included — those are theirs and
  // hiding half of them behind a dev toggle makes the tab lie about what
  // exists. Somebody else's disabled method is still not theirs to see: it
  // used to appear too, because owning anything revealed every closed method.
  const isOwnerView = ownedMethodIds.length > 0;
  const visibleMethods = useMemo(
    () =>
      showDisabled
        ? methods
        : methods.filter((m) => m.enabled || owned.has(m.id)),
    [methods, owned, showDisabled]
  );

  const sortedMethods = useMemo(
    () =>
      [...visibleMethods].sort(
        (a, b) =>
          Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)
      ),
    [visibleMethods]
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Heading level="h3" as="h2">
          Investment methods
        </Heading>
        <Text variant="muted">
          {isOwnerView
            ? "The methods you run and the capital sitting in each."
            : "Strategies you can invest in."}
        </Text>
      </div>

      {sortedMethods.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No investment methods yet"
          description={
            isOwnerView
              ? "Create a method and investors will be able to put money into it."
              : "Methods appear here once a provider publishes one."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedMethods.map((method) => (
              <MethodCard
                key={method.id}
                method={method}
                allocation={
                  allocations.find((a) => a.methodId === method.id)?.allocations ?? []
                }
                capital={capital.find((c) => c.methodId === method.id)}
                hideValues={hideValues}
                onEdit={
                  owned.has(method.id) && onEditMethod
                    ? () => onEditMethod(method)
                    : undefined
                }
              />
            ))}
        </div>
      )}
    </section>
  );
}

function MethodCard({
  method,
  allocation,
  capital,
  hideValues = false,
  onEdit,
}: {
  method: InvestmentMethod;
  allocation: { symbol: string; percent: number }[];
  capital?: MethodCapital;
  hideValues?: boolean;
  /** Absent for methods this user does not run — no edit affordance, and no
   *  internal allocation shown. */
  onEdit?: () => void;
}) {
  const risk = normaliseRisk(method.riskLevel);
  const badge = RISK_BADGE[risk];
  const roi = parseFloat(method.monthlyRoi);
  return (
    <Card className={cn(!method.enabled && "opacity-60")}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {!method.enabled && (
            <Badge variant="secondary">
              <EyeOff aria-hidden /> Closed
            </Badge>
          )}
        </div>
        {onEdit && (
          <CardAction>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Edit ${method.name}`}
              onClick={onEdit}
            >
              <Pencil />
            </Button>
          </CardAction>
        )}
        <CardTitle as="h3" className="line-clamp-2">
          {method.name}
        </CardTitle>
        {method.description && (
          <CardDescription className="line-clamp-2">{method.description}</CardDescription>
        )}
        {/* Internal, and only ever rendered for the person who runs it. Spans
            both header columns: left to auto-placement it landed in the edit
            button's column, which widened to fit it and truncated the title. */}
        {onEdit && (
          <Text variant="small" className="col-span-full text-2xs">
            {allocation.length === 0
              ? "No allocation set"
              : `Invests in ${allocation.map((a) => `${a.percent}% ${a.symbol}`).join(" · ")}`}
          </Text>
        )}
      </CardHeader>
      <CardContent className="mt-auto">
        <div className="flex items-baseline justify-between border-t pt-3">
          <div className="flex flex-col gap-0.5">
            <Eyebrow as="div">Monthly ROI</Eyebrow>
            <Mono
              className={cn(
                "text-xl font-semibold tabular-nums sm:text-2xl",
                roi >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {Number.isFinite(roi) ? formatRoi(roi) : "—"}
            </Mono>
          </div>

          {/* What is actually sitting in this method. Only present for methods
              this user runs; a client browsing has no business seeing it. */}
          {capital && (
            <div className="flex flex-col gap-0.5 text-right">
              <Eyebrow as="div">Invested</Eyebrow>
              <Mono className="text-xl font-semibold tabular-nums sm:text-2xl">
                {hideValues
                  ? maskValue(formatCurrency(capital.invested))
                  : formatCurrency(capital.invested)}
              </Mono>
              <Text variant="small" className="text-2xs">
                {capital.investorCount === 0
                  ? "nobody yet"
                  : `${capital.investorCount} ${
                      capital.investorCount === 1 ? "investor" : "investors"
                    } · now ${
                      hideValues
                        ? maskValue(formatCurrency(capital.holding))
                        : formatCurrency(capital.holding)
                    }`}
              </Text>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
