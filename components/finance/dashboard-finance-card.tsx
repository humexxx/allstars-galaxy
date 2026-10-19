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
import { Eyebrow, Mono } from "@/components/ui/typography";
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
import {
  formatDebtFree,
  formatDebtFreeMonth,
  type DebtFreeStatus,
} from "@/lib/finance/chart-series";
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

  const netWorth: Figure = {
    label: "Net worth",
    value: formatCurrency(fig.netWorth),
    tone: moneySign(fig.netWorth) >= 0 ? "positive" : "negative",
  };
  const breakdown: Figure[] = [
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
    { label: "Debt-free", ...debtFreeFigure(fig.debtFree, full.debts.length > 0) },
  ];
  // A plan with no periods has no line to draw, and a rail beside nothing is
  // a column of figures with a hole on its left.
  const rail = points.length > 0;

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
      {/* Laid out on the card's width, not the viewport's: from `md` the
          sidebar takes 256px, so this card is narrower at 800px than at 700px.
          Wide, the chart fills the left and the figures stack in a rail on the
          right; narrow, net worth heads the chart it plots and the breakdown
          follows. */}
      <CardContent className="@container">
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            rail && "@xl:grid-cols-[minmax(0,1fr)_14rem] @xl:grid-rows-[auto_1fr] @xl:gap-x-8"
          )}
        >
          <dl className={cn(rail && "@xl:col-start-2")}>
            <FigureItem figure={netWorth} hero />
          </dl>
          <DashboardFinanceMiniChart
            data={points}
            color={featured.color}
            className="h-48 sm:h-56 @xl:col-start-1 @xl:row-span-2 @xl:row-start-1 @xl:h-auto @xl:min-h-72"
          />
          <dl
            className={cn(
              "grid grid-cols-2 gap-x-4 gap-y-3",
              rail && "@xl:col-start-2 @xl:grid-cols-1 @xl:self-end"
            )}
          >
            {breakdown.map((f) => (
              <FigureItem key={f.label} figure={f} />
            ))}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

type FigureTone = "neutral" | "positive" | "negative" | "primary";

type Figure = {
  label: string;
  value: string;
  /** Muted, beside the value: the countdown next to a payoff month. */
  note?: string;
  tone?: FigureTone;
};

/**
 * The payoff month as the figure and the countdown as its note: "Jan 2027"
 * with "in 12 mo" beside it, which a narrow phone cell wraps whole instead of
 * breaking the date in two.
 */
function debtFreeFigure(
  status: DebtFreeStatus,
  hasDebts: boolean
): Pick<Figure, "value" | "note"> {
  if (!hasDebts && status.kind === "no-debt") return { value: "—" };
  if (status.kind !== "on-track") return { value: formatDebtFree(status) };
  return { value: formatDebtFreeMonth(status.date), note: `in ${status.months} mo` };
}

/**
 * The StatCard figure (Eyebrow label, Mono value, `statToneClass`) as one
 * term of this card's description list. `hero` is StatCard's own size; the
 * breakdown is one step down, the secondary-stat size.
 */
function FigureItem({ figure, hero = false }: { figure: Figure; hero?: boolean }) {
  const { label, value, note, tone = "neutral" } = figure;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Eyebrow size="sm" asChild>
        <dt>{label}</dt>
      </Eyebrow>
      <dd className="flex flex-wrap items-baseline gap-x-2">
        <Mono
          className={cn(
            "font-semibold",
            hero ? "text-xl sm:text-2xl" : "text-base sm:text-lg",
            tone === "primary" ? "text-primary" : tone !== "neutral" && statToneClass(tone)
          )}
        >
          {value}
        </Mono>
        {note && <Mono className="text-xs text-muted-foreground">{note}</Mono>}
      </dd>
    </div>
  );
}
