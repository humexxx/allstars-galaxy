"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Copy, Highlighter, LineChart, MoreHorizontal, Star, Trash2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Mono } from "@/components/ui/typography";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  clonePlanAction,
  deletePlanAction,
  setMainPlanAction,
} from "@/app/actions/finance-plans";
import { PlanColorPicker } from "./plan-color-picker";
import { runAction } from "@/lib/actions/run";
import { cn } from "@/lib/utils";
import { formatCurrency, moneySign } from "@/lib/utils/format";
import {
  formatDebtFree,
  summaryDebtFree,
  type PlanTimeline,
} from "@/lib/finance/chart-series";
import type { FinancePlan, PlanSummary } from "@/types/finance";

const END_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// Same rationale as plan-editor / compare-view: defer recharts to a lazy chunk
// so the list page's first paint stays light.
const ComparePlansChart = dynamic(
  () => import("./projection-chart").then((mod) => mod.ComparePlansChart),
  {
    ssr: false,
    loading: () => <Skeleton className={`w-full ${CHART_HEIGHT}`} />,
  }
);

const CHART_HEIGHT = "h-64 sm:h-80 lg:h-115";

type Metric = "netWorth" | "totalDebt";

const METRIC_LABEL: Record<Metric, string> = {
  netWorth: "Net worth",
  totalDebt: "Total debt",
};

/** Horizon options, in periods. `0` means "as far as the projections run". */
const RANGES = [
  { value: "12", label: "12 months" },
  { value: "24", label: "24 months" },
  { value: "36", label: "3 years" },
  { value: "60", label: "5 years" },
  { value: "0", label: "Full plan" },
] as const;

const DEFAULT_RANGE = "24";
/** Periods before today kept in view, regardless of the horizon picked. */
const PAST_MONTHS = 3;

const POSITIVE = "text-success";
const NEGATIVE = "text-destructive";

/**
 * Polymarket-style plans workspace: a giant comparison chart on the left and a
 * rail of plans on the right (stacked below on mobile). The rail rows double as
 * the chart's series toggles — checking a plan adds its line to the chart —
 * while still linking through to the plan and exposing clone / delete / set-main.
 *
 * Rows also drive emphasis: pointing at one fades every other series back, and
 * its colour swatch pins that focus so it survives the pointer leaving (and is
 * reachable on touch, where there is no hover at all).
 */
export function PlansWorkspace({
  plans,
  summaries,
  timelines,
  today,
}: {
  plans: FinancePlan[];
  summaries: Record<string, PlanSummary>;
  /** Each plan's timeline (real past + calibrated future), keyed by plan id. */
  timelines: Record<string, PlanTimeline>;
  /** The reader's calendar day — the chart's today boundary. */
  today: Date;
}) {
  const [isPending, startTransition] = useTransition();
  // Deleting a row unmounts the menu that opened the dialog, so focus would
  // fall back to <body>; it lands on the list heading instead.
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const deletedRef = useRef(false);
  const [pendingDelete, setPendingDelete] = useState<FinancePlan | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(plans.map((p) => p.id))
  );
  // A plan cloned or created after mount arrives through router.refresh(),
  // which reconciles rather than remounts — so it has to be added to the
  // selection here or the copy shows up unchecked, with no line on the chart.
  const [knownIds, setKnownIds] = useState<string[]>(() => plans.map((p) => p.id));
  const currentIds = plans.map((p) => p.id);
  if (
    currentIds.length !== knownIds.length ||
    currentIds.some((id, i) => id !== knownIds[i])
  ) {
    const known = new Set(knownIds);
    const added = currentIds.filter((id) => !known.has(id));
    setKnownIds(currentIds);
    if (added.length > 0) {
      setSelected((prev) => new Set([...prev, ...added]));
    }
  }
  const [metric, setMetric] = useState<Metric>("netWorth");
  const [range, setRange] = useState<string>(DEFAULT_RANGE);
  // "Full plan" draws every month any plan covers; the others window around
  // today (PAST_MONTHS before it).
  const months = Number(range) || undefined;
  // Two sources of emphasis: pointing at a rail row (transient) and pinning one
  // via its colour swatch (sticky, and the only route on touch, where there is
  // no hover). A pin always wins over a hover.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const focusedId = pinnedId ?? hoveredId;
  const focusedPlan = plans.find((p) => p.id === focusedId) ?? null;

  const filtered = useMemo(
    () =>
      plans
        .filter((p) => selected.has(p.id) && timelines[p.id])
        .map((p) => ({ plan: p, timeline: timelines[p.id] })),
    [plans, timelines, selected]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // The actions revalidate the plans segment, so the new props arrive with
  // their response — no router.refresh() needed.
  const handleClone = (plan: FinancePlan) => {
    startTransition(async () => {
      await runAction(clonePlanAction(plan.id, `${plan.name} (copy)`), {
        success: "Plan cloned",
        failure: "Failed to clone plan",
      });
    });
  };

  const handleSetMain = (plan: FinancePlan) => {
    if (plan.isMain) return;
    startTransition(async () => {
      await runAction(setMainPlanAction(plan.id), {
        success: `${plan.name} is now your main plan`,
        failure: "Failed to set the main plan",
      });
    });
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    startTransition(async () => {
      const result = await runAction(deletePlanAction(pendingDelete.id), {
        success: "Plan deleted",
        failure: "Failed to delete plan",
      });
      if (result.ok) {
        deletedRef.current = true;
        setPendingDelete(null);
      }
    });
  };

  return (
    <>
      {/* Hero grid: chart fills 2/3 on desktop, the plan rail rides the right
          1/3 — a quarter squeezed plan names down to ~4 characters. Single
          column on mobile (chart first, then the rail). */}
      {/* min-w-0 on both grid children: grid items default to min-width:auto,
          so recharts' measured svg would inflate the column past the viewport
          on mobile instead of shrinking. The chart card sets the row height
          on lg and the rail fills it (see the rail card). */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <CardTitle as="h2">Projection comparison</CardTitle>
              {focusedPlan && (
                <Badge variant="outline" className="min-w-0 text-muted-foreground">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: focusedPlan.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{focusedPlan.name}</span>
                </Badge>
              )}
            </div>
            {/* Both controls at h-8, so the row has one height. */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger size="sm" className="w-38" aria-label="Horizon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ToggleGroup
                type="single"
                size="sm"
                value={metric}
                onValueChange={(v) => v && setMetric(v as Metric)}
                aria-label="Metric"
              >
                {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                  <ToggleGroupItem key={m} value={m}>
                    {METRIC_LABEL[m]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </CardHeader>
          {/* The Card default of px-6 costs 48 of a 375px screen before a
              single pixel of chart is drawn. Data ink wins on phones; desktop
              keeps the standard gutter. */}
          <CardContent className="px-3 sm:px-6">
            {filtered.length === 0 ? (
              <EmptyState
                icon={LineChart}
                title="No plans in the chart"
                description="Select at least one plan to chart."
                className={cn("flex flex-col justify-center", CHART_HEIGHT)}
              />
            ) : (
              <ComparePlansChart
                series={filtered}
                today={today}
                metric={metric}
                heightClass={CHART_HEIGHT}
                focusedPlanId={focusedId}
                months={months}
                pastMonths={PAST_MONTHS}
                // The rail beside (or under) the chart already names and
                // colours every series; with many plans the legend wrapped
                // each name word by word under the plot.
                legendClassName="hidden"
              />
            )}
          </CardContent>
        </Card>

        {/* h-0 + min-h-full on lg: the rail takes the chart card's height
            instead of setting the row's — with many plans it stretched the
            chart card into a tall empty band under the plot. The list
            scrolls inside it instead. */}
        <Card className="min-w-0 lg:h-0 lg:min-h-full">
          <CardHeader>
            <Eyebrow asChild>
              <h2 ref={listHeadingRef} tabIndex={-1} className="outline-none">
                Your plans
              </h2>
            </Eyebrow>
            <CardDescription>
              Tick plans to chart them; a plan’s dot sets its line colour.
            </CardDescription>
          </CardHeader>
          <CardContent className="lg:min-h-0 lg:overflow-y-auto">
            <ul className="flex flex-col gap-2">
              {plans.map((plan) => {
                const s = summaries[plan.id];
                const inChart = selected.has(plan.id);
                return (
                  <li
                    key={plan.id}
                    onMouseEnter={() => setHoveredId(plan.id)}
                    onMouseLeave={() =>
                      setHoveredId((cur) => (cur === plan.id ? null : cur))
                    }
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors hover:bg-muted/40",
                      focusedId === plan.id && "border-foreground/30 bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={inChart}
                      onCheckedChange={() => toggle(plan.id)}
                      aria-label={`Toggle ${plan.name} in chart`}
                    />
                    <PlanColorPicker plan={plan} pinned={pinnedId === plan.id} />
                    <Link
                      href={`/portal/plans/${plan.id}`}
                      className="min-w-0 flex-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="truncate text-sm font-medium"
                          title={plan.name}
                        >
                          {plan.name}
                        </span>
                        {plan.isMain && (
                          <>
                            <Star
                              className="size-3.5 shrink-0 fill-warning text-warning"
                              aria-hidden="true"
                            />
                            <span className="sr-only">(main plan)</span>
                          </>
                        )}
                      </div>
                      {s && (
                        // Two lines, not one wrapping row: wrapped, the "·"
                        // separator was left dangling at the end of line one.
                        <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
                          <span className="flex flex-wrap items-baseline gap-x-1">
                            Net worth
                            <Mono
                              className={
                                moneySign(s.endingNetWorth) > 0
                                  ? POSITIVE
                                  : moneySign(s.endingNetWorth) < 0
                                    ? NEGATIVE
                                    : undefined
                              }
                            >
                              {formatCurrency(s.endingNetWorth)}
                            </Mono>
                            {/* Dated: each plan ends on its own horizon. */}
                            {s.endDate && <span>at {END_LABEL.format(s.endDate)}</span>}
                          </span>
                          {(() => {
                            const status = summaryDebtFree(s);
                            return (
                              <span
                                className={
                                  status.kind === "beyond-horizon"
                                    ? NEGATIVE
                                    : status.kind === "no-debt"
                                      ? undefined
                                      : POSITIVE
                                }
                              >
                                {status.kind === "beyond-horizon"
                                  ? "Debt beyond horizon"
                                  : formatDebtFree(status)}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${plan.name}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Pinning lives here rather than on the swatch (which
                            now opens the colour picker) so it stays reachable
                            on touch, where there is no hover to highlight. */}
                        <DropdownMenuItem
                          onSelect={() =>
                            setPinnedId((cur) =>
                              cur === plan.id ? null : plan.id
                            )
                          }
                        >
                          <Highlighter />
                          {pinnedId === plan.id
                            ? "Stop highlighting"
                            : "Highlight in chart"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleSetMain(plan)}
                          disabled={plan.isMain}
                        >
                          <Star />
                          {plan.isMain ? "Main plan" : "Set as main"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleClone(plan)}>
                          <Copy />
                          Clone
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setPendingDelete(plan)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            if (!deletedRef.current) return;
            deletedRef.current = false;
            e.preventDefault();
            listHeadingRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.name}</strong> and all its income, expense
              and debt rows will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            {/* preventDefault keeps the dialog open until the delete lands, so
                the pending state is visible and a failure has somewhere to be. */}
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isPending}
            >
              {isPending && <Spinner />}
              {isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
