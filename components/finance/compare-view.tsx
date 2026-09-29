"use client";

import { debtFreeMonthsFromNow } from "@/lib/finance/chart-series";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { LineChart } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow, Heading, Mono } from "@/components/ui/typography";

import { formatCurrency } from "@/lib/utils/format";
import type { Projection } from "@/types/finance";

// Same rationale as plan-editor: defer recharts to a lazy chunk.
const ComparePlansChart = dynamic(
  () => import("./projection-chart").then((mod) => mod.ComparePlansChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-96 w-full" />,
  }
);

type Metric = "netWorth" | "totalDebt";

type CompareViewProps = {
  projections: Projection[];
  /** When false, hide the per-plan "Ending state" cards — used when the host
   *  page (e.g. the plans list) already shows those numbers on each plan card. */
  showEndingState?: boolean;
};

export function CompareView({
  projections,
  showEndingState = true,
}: CompareViewProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(projections.map((p) => p.plan.id))
  );
  // A plan cloned or created after mount arrives through router.refresh(),
  // which reconciles rather than remounts — so it has to be added to the
  // selection here or the copy shows up unchecked, with no line on the chart.
  const [knownIds, setKnownIds] = useState<string[]>(() => projections.map((p) => p.plan.id));
  const currentIds = projections.map((p) => p.plan.id);
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

  const filtered = useMemo(
    () => projections.filter((p) => selected.has(p.plan.id)),
    [projections, selected]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <Eyebrow asChild>
            <h2>Plans in chart</h2>
          </Eyebrow>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {projections.map((p) => (
              <label
                key={p.plan.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
              >
                {/* The wrapping label names the checkbox: a second <Label>
                    inside it was a label nested in a label. */}
                <Checkbox
                  checked={selected.has(p.plan.id)}
                  onCheckedChange={() => toggle(p.plan.id)}
                />
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: p.plan.color }}
                  aria-hidden="true"
                />
                <span>{p.plan.name}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Projection comparison</CardTitle>
          <CardAction>
            <ToggleGroup
              type="single"
              size="sm"
              value={metric}
              onValueChange={(v) => v && setMetric(v as Metric)}
              aria-label="Metric"
            >
              <ToggleGroupItem value="netWorth">Net worth</ToggleGroupItem>
              <ToggleGroupItem value="totalDebt">Total debt</ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={LineChart}
              title="No plans selected"
              description="Select at least one plan above."
            />
          ) : (
            <ComparePlansChart projections={filtered} metric={metric} />
          )}
        </CardContent>
      </Card>

      {showEndingState && (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Ending state per plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projections.map((p) => (
                <EndingStateTile key={p.plan.id} projection={p} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EndingStateTile({ projection: p }: { projection: Projection }) {
  const debtFreeIn = debtFreeMonthsFromNow(p);
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderLeftColor: p.plan.color, borderLeftWidth: 4 }}
    >
      <div className="flex items-center justify-between gap-2">
        <Heading level="h6" as="h3">{p.plan.name}</Heading>
        {debtFreeIn !== null && (
          <Badge variant="outline">
            {debtFreeIn === 0 ? "Debt-free" : `Debt-free in ${debtFreeIn} mo`}
          </Badge>
        )}
      </div>
      <dl className="mt-3 flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Savings</dt>
          <dd><Mono>{formatCurrency(p.endingSavings)}</Mono></dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Debt</dt>
          <dd><Mono>{formatCurrency(p.endingDebt)}</Mono></dd>
        </div>
        <div className="flex justify-between border-t pt-1 font-semibold">
          <dt>Net worth</dt>
          <dd>
            <Mono className={p.endingNetWorth >= 0 ? "text-success" : "text-destructive"}>
              {formatCurrency(p.endingNetWorth)}
            </Mono>
          </dd>
        </div>
      </dl>
    </div>
  );
}
