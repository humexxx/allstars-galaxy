import Link from "next/link";
import {
  ArrowRight,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { statToneClass } from "@/components/ui/stat-card";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { DashboardFinanceMiniChart } from "./dashboard-finance-mini-chart";
import { formatCurrency, formatSignedCurrency, moneySign } from "@/lib/utils/format";
import {
  getMainPlan,
  getPlanWithLines,
  listUserPlans,
} from "@/lib/services/finance-plan-service";
import { loadCalibratedView } from "@/lib/services/finance-snapshot-service";
import { buildDashboardFigures } from "@/lib/finance/dashboard";
import type { DebtFreeStatus } from "@/lib/finance/chart-series";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import { todayInTimeZone } from "@/lib/utils/date";

type DashboardFinanceCardProps = {
  userId: string;
};

export async function DashboardFinanceCard({ userId }: DashboardFinanceCardProps) {
  const plans = await listUserPlans(userId);

  if (plans.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Wallet className="size-5 shrink-0" aria-hidden="true" />
            Finance plan
          </CardTitle>
          <CardDescription>
            Build a plan to project your savings, debts and net worth month by month.
          </CardDescription>
          <CardAction>
            <Button asChild>
              <Link href="/portal/plans/new">
                <PlusCircle />
                Create plan
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
      </Card>
    );
  }

  const featured =
    (await getMainPlan(userId)) ??
    plans.slice().sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    )[0];
  const full = await getPlanWithLines(featured.id, userId);
  if (!full) return null;

  // Exactly what the plan page shows: the calibrated plan (portfolio growth
  // included), with "now" as the day-aware position in the reader's zone.
  const timeZone = await getRequestTimeZone();
  const now = todayInTimeZone(timeZone);
  const view = await loadCalibratedView(full, userId, now, { timeZone });
  const fig = buildDashboardFigures(
    view.projection,
    view.today,
    full.confirmationDayOfMonth,
    now
  );
  const points = fig.points;
  const delta = fig.delta;
  // The reader's calendar day, not the server's: this renders on the server
  // (UTC), which dated an evening edit in Costa Rica "tomorrow".
  const updated = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(featured.updatedAt);

  const debtFree = debtFreeTile(fig.debtFree, full.debts.length > 0);
  const kpis: Array<{ label: string; value: string; hint?: string; tone?: KpiTone; wide?: boolean }> = [
    {
      label: fig.status === "before-start" ? "Savings at start" : "Savings now",
      value: formatCurrency(fig.savings),
    },
    { label: "Investments", value: formatCurrency(fig.investments), tone: "primary" },
    {
      label: "Debt now",
      value: formatCurrency(fig.totalDebt),
      // Red like the plan page's Total debt row, which shows this figure.
      tone: moneySign(fig.totalDebt) > 0 ? "negative" : undefined,
    },
    { label: "Debt-free", ...debtFree },
    {
      label: "Net worth",
      value: formatCurrency(fig.netWorth),
      tone:
        moneySign(fig.netWorth) > 0
          ? "positive"
          : moneySign(fig.netWorth) < 0
            ? "negative"
            : undefined,
      // Five tiles in a two-column phone grid left this one alone on its
      // row; as the headline figure it takes the whole row instead.
      wide: true,
    },
  ];

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle as="h2" className="flex min-w-0 items-center gap-2">
          <Wallet className="size-5 shrink-0" aria-hidden="true" />
          <span className="truncate">{featured.name}</span>
        </CardTitle>
        {/* The delta rides the description line, not the action slot: beside
            the button it squeezed the plan name to a few characters on phones. */}
        <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
          <span>
            12-month projection ·{" "}
            <span className="whitespace-nowrap">updated {updated}</span>
          </span>
          <Badge variant={moneySign(delta) >= 0 ? "success" : "destructive"} className="font-mono tabular-nums">
            {moneySign(delta) >= 0 ? <TrendingUp /> : <TrendingDown />}
            {formatSignedCurrency(delta)} · {fig.deltaPeriods} mo
          </Badge>
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/portal/plans/${featured.id}`}>
              Open
              <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {kpis.map((k) => (
            <KpiTile key={k.label} {...k} />
          ))}
        </div>
        <DashboardFinanceMiniChart data={points} color={featured.color} />
      </CardContent>
    </Card>
  );
}

type KpiTone = "neutral" | "positive" | "negative" | "primary";

/**
 * The Debt-free tile: the payoff month as the figure, the distance under it.
 * As one string ("in 10 mo · Jun 2027") it wrapped onto two lines at every
 * width and made its tile the odd one out in the row.
 */
function debtFreeTile(
  status: DebtFreeStatus,
  hasDebts: boolean
): { value: string; hint?: string } {
  switch (status.kind) {
    case "no-debt":
      return { value: hasDebts ? "No debt" : "—" };
    case "debt-free":
      return { value: "Now" };
    case "beyond-horizon":
      return { value: "Not yet", hint: "beyond the plan" };
    case "on-track":
      return {
        value: DEBT_FREE_MONTH.format(status.date),
        hint: `in ${status.months} mo`,
      };
  }
}

const DEBT_FREE_MONTH = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * The StatCard figure (Eyebrow label, Mono value, `statToneClass`) as a tile
 * inside this card rather than a card of its own. One step smaller than
 * StatCard's figure: five of these share a row from `sm`.
 */
function KpiTile({
  label,
  value,
  hint,
  tone = "neutral",
  wide = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: KpiTone;
  /** Spans both columns of the phone grid. */
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border p-3",
        wide && "col-span-2 sm:col-span-1"
      )}
    >
      <Eyebrow size="sm" as="div">
        {label}
      </Eyebrow>
      <Mono
        className={cn(
          "truncate text-lg font-semibold tabular-nums sm:text-xl",
          tone === "primary" ? "text-primary" : tone !== "neutral" && statToneClass(tone)
        )}
      >
        {value}
      </Mono>
      {hint && (
        <Text variant="small" as="span" className="text-2xs">
          {hint}
        </Text>
      )}
    </div>
  );
}
