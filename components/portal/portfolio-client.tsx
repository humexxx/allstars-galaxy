"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Camera,
  ChartLine,
  CircleDashed,
  Download,
  Eye,
  EyeOff,
  ListFilter,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InvestmentMethodsView } from "@/components/portfolio/investment-methods-view";
import { MethodEditorDialog } from "@/components/portfolio/method-editor-dialog";
import { AllocationDialog } from "@/components/portal/allocation-dialog";
import { OwnerKpiGrid } from "@/components/portal/owner-kpi-grid";
import { PageHeader } from "@/components/portal/page-header";

import { StatCard, maskValue, statToneClass } from "@/components/ui/stat-card";
import { Sparkline } from "@/components/portfolio/sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { Heading, Text } from "@/components/ui/typography";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { runAction } from "@/lib/actions/run";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
} from "@/lib/utils/format";

import { AddTransactionDialog } from "@/components/portfolio/add-transaction-dialog";
import { EmptyPortfolio } from "@/components/portfolio/empty-portfolio";
import { ManualSnapshotDialog } from "@/components/portfolio/manual-snapshot-dialog";
import { TransactionsTable } from "@/components/portfolio/transactions-table";
import { InvestorSummaryTable } from "@/components/portfolio/investor-summary-table";
import type { CashFlowPoint } from "@/components/portfolio/performance-series";
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
import { useRegisterDevTool } from "@/components/dev-tools/dev-tools-context";

import { createTransactionAction } from "@/app/actions/transactions";
import { deleteManualSnapshotsAction } from "@/app/actions/portfolio-snapshots";
import { repriceContributionsAction } from "@/app/actions/allocations";
import type { MarginPoint } from "@/lib/finance/margin-history";
import type { ChartDataPoint } from "@/types/chart";
import type {
  InvestorBreakdown as InvestorBreakdownRow,
  MarginHistoryInput,
  MethodAllocationSummary,
} from "@/types/margin";
import type {
  AssetOption,
  InvestmentMethod,
  Portfolio,
  PortfolioStats,
  PortfolioTransaction,
  MethodInvestors,
  TransactionTableRow,
} from "@/types/portfolio";

type User = {
  id: string;
  fullName: string | null;
  email: string | null;
};

type PortfolioData = {
  portfolio: Pick<Portfolio, "id" | "name"> | null;
  stats: PortfolioStats | null;
  transactions: PortfolioTransaction[];
  chartData: ChartDataPoint[];
  /** Approved cash in (+) and out (-), so the performance chart can tell a
   *  deposit from a gain. */
  cashFlows: CashFlowPoint[];
  methods: InvestmentMethod[];
  isAdmin: boolean;
  users?: User[];
  /** Methods this user owns + who holds money in them. Empty for everyone
   *  who doesn't run any. Never folded into the portfolio totals. */
  methodInvestors: MethodInvestors[];
  /** Catalogue of priceable assets, for configuring allocations. */
  priceAssets: AssetOption[];
  /** Each owned method's allocation policy — where new money goes. */
  methodAllocations: MethodAllocationSummary[];
  /** What other people did in the methods this user runs. Empty for everyone
   *  who runs none. */
  investorTransactions: TransactionTableRow[];
  /** The owner's own history, in the shared row shape. */
  transactionRows: TransactionTableRow[];
  /** Margin month by month, for the headline figures. */
  marginHistory: MarginPoint[];
  /** Raw inputs so the chart can re-derive under a filter without a round trip. */
  marginHistoryInput: MarginHistoryInput;
  /** Per-investor drill-down behind the margin. */
  investorBreakdown: InvestorBreakdownRow[];
  /** How much of the book is priced: nothing (`unconfigured`), or all but
   *  `unpriced` contributions. */
  marginStatus: { unconfigured: boolean; unpriced: number };
  currentUserId: string;
};

// The owner-only panels pull recharts and a long table into the portfolio
// chunk for every visitor, though only method owners ever see them. Split them
// so an investor's bundle stops paying for the owner's dashboard.
const MarginChart = dynamic(
  () =>
    import("@/components/portal/margin-chart").then((mod) => mod.MarginChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
  }
);

const InvestorBreakdown = dynamic(
  () =>
    import("@/components/portal/investor-breakdown").then(
      (mod) => mod.InvestorBreakdown
    ),
  { loading: () => <Skeleton className="h-64 w-full rounded-xl" /> }
);

const PerformanceChart = dynamic(
  () =>
    import("@/components/portfolio/performance-chart").then(
      (mod) => mod.PerformanceChart
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-96 w-full rounded-xl" />,
  }
);

export default function PortfolioClientPage({ data }: { data: PortfolioData }) {
  // The transaction form only ever offered live methods; the Methods tab gets
  // the full list because it filters (and can reveal disabled) itself.
  // The Investors tab only exists for people who actually run methods.
  const ownsMethods = data.methodInvestors.length > 0;

  // Approved-only by default: those are the movements that actually happened.
  // Pending and rejected rows matter, but they are the exception you go
  // looking for, not the default reading of a history.
  const [detailedTransactions, setDetailedTransactions] = useState(false);

  const visibleRows = useMemo(() => {
    const own = detailedTransactions
      ? data.transactionRows
      : data.transactionRows.filter((t) => t.status === "approved");
    return {
      own,
      // Only rows this toggle actually hides. Investors are summarised one
      // line per person whatever the view, so counting their pending rows
      // here promised "4 hidden" and then revealed one.
      hiddenCount: data.transactionRows.length - own.length,
    };
  }, [data.transactionRows, detailedTransactions]);

  // Capital per method, straight off the investor aggregate the Managed tab
  // already loads. Only methods this user runs appear here, so a client
  // browsing the catalogue gets nothing.
  const methodCapital = useMemo(
    () =>
      data.methodInvestors.map((m) => ({
        methodId: m.methodId,
        // Net of withdrawals: the holding beside it already is, so a gross
        // figure made every withdrawal read as money the method lost.
        invested:
          m.totalInvested - m.investors.reduce((sum, i) => sum + i.withdrawn, 0),
        holding: m.totalHolding,
        investorCount: m.investors.length,
      })),
    [data.methodInvestors]
  );

  // The default view: one row per person, summarising the relationship rather
  // than listing it. The per-transaction detail already exists a click away.
  const investorSummary = useMemo(
    () =>
      data.investorBreakdown
        .filter((b) => !b.isOwn)
        .map((b) => ({
          ...b,
          // By id: two investors can share a display name (or both fall back
          // to "Unknown"), and the name join summed their movements together.
          movements: data.investorTransactions.filter(
            (t) => t.investorId === b.investorId
          ).length,
        })),
    [data.investorBreakdown, data.investorTransactions]
  );

  const ownerKpis = useMemo(() => {
    const h = data.marginHistory;
    const last = h[h.length - 1];
    if (!last) return null;
    return {
      contributed: last.invested,
      deployed: last.deployed,
      liability: last.liability,
      margin: last.margin,
      monthlyChange: h.length >= 2 ? last.margin - h[h.length - 2].margin : null,
    };
  }, [data.marginHistory]);

  const enabledMethods = useMemo(
    () => data.methods.filter((m) => m.enabled),
    [data.methods]
  );
  // Stable identity so the methods view's own Set memo actually hits.
  const ownedMethodIds = useMemo(
    () => data.methodInvestors.map((m) => m.methodId),
    [data.methodInvestors]
  );

  const [editingMethod, setEditingMethod] = useState<InvestmentMethod | null>(null);
  const [allocatingMethod, setAllocatingMethod] = useState<InvestmentMethod | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [hideValues, setHideValues] = useState(false);
  const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // ── Dev-drawer registrations ──────────────────────────────────────────────
  // Helpers are memoised so `useRegisterDevTool` only re-registers when the
  // state actually flips, not on every parent render.
  const showChartsTool = useMemo(
    () => ({
      id: "portfolio:show-charts",
      kind: "toggle" as const,
      label: "Show charts",
      description: "Show the chart on the overview tab.",
      section: "View",
      checked: showCharts,
      onChange: setShowCharts,
    }),
    [showCharts]
  );
  const hideValuesTool = useMemo(
    () => ({
      id: "portfolio:hide-values",
      kind: "toggle" as const,
      label: "Hide values",
      description: "Mask dollar amounts (screenshots, demos).",
      section: "View",
      checked: hideValues,
      onChange: setHideValues,
    }),
    [hideValues]
  );
  const repriceTool = useMemo(
    () =>
      ownsMethods
        ? {
            id: "portfolio:reprice",
            kind: "action" as const,
            label: "Reprice contributions",
            description:
              "Value any approved contribution that has no allocation yet, at the price on the day it landed.",
            section: "Admin",
            icon: RefreshCw,
            onRun: async () => {
              const result = await runAction(repriceContributionsAction(), {
                failure: "Failed to reprice contributions",
              });
              if (!result.ok) return;
              const priced = result.data?.priced ?? 0;
              if (priced > 0) {
                toast.success(
                  priced === 1 ? "Priced 1 contribution split" : `Priced ${priced} contribution splits`
                );
              } else {
                toast.info("Nothing new to price");
              }
            },
          }
        : null,
    [ownsMethods]
  );

  const manualSnapshotTool = useMemo(
    () =>
      data.isAdmin
        ? {
            id: "portfolio:manual-snapshot",
            kind: "action" as const,
            label: "Manual snapshot",
            description: "Record every portfolio's value on a chosen day.",
            section: "Admin",
            icon: Camera,
            onRun: () => setIsSnapshotDialogOpen(true),
          }
        : null,
    [data.isAdmin]
  );
  const clearSnapshotsTool = useMemo(
    () =>
      data.isAdmin
        ? {
            id: "portfolio:clear-snapshots",
            kind: "action" as const,
            label: "Clear manual snapshots",
            description:
              "Delete every manual snapshot, across all portfolios. System ones stay.",
            section: "Admin",
            icon: Trash2,
            variant: "destructive" as const,
            onRun: () => setIsClearDialogOpen(true),
          }
        : null,
    [data.isAdmin]
  );

  useRegisterDevTool(showChartsTool);
  useRegisterDevTool(hideValuesTool);
  useRegisterDevTool(repriceTool);
  useRegisterDevTool(manualSnapshotTool);
  useRegisterDevTool(clearSnapshotsTool);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddTransaction = async (transactionData: {
    investmentMethodId: string;
    amount: string;
    date: Date;
    notes?: string;
    userId?: string;
  }): Promise<boolean> => {
    const result = await runAction(createTransactionAction(transactionData), {
      failure: "Failed to add transaction",
    });
    if (!result.ok) return false;
    toast.success(
      result.data?.status === "approved" ? "Transaction added and approved" : "Transaction added"
    );
    return true;
  };

  const handleClearSnapshots = async (): Promise<void> => {
    setIsClearing(true);
    const result = await runAction(deleteManualSnapshotsAction(), {
      success: "Manual snapshots deleted",
      failure: "Failed to delete snapshots",
    });
    setIsClearing(false);
    if (result.ok) setIsClearDialogOpen(false);
  };

  if (!data.portfolio) {
    // No portfolio yet — but the methods catalogue used to be its own page and
    // needs nothing from a portfolio, so it stays reachable. Browsing methods
    // is exactly what you do BEFORE you have one.
    return (
      <>
        <PageHeader
          title="Portfolio"
          description="Browse the investment methods, then add your first transaction."
        />
        <Tabs defaultValue="overview" className="gap-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="methods">Methods</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <EmptyPortfolio onAddTransaction={() => setIsDialogOpen(true)} />
          </TabsContent>
          <TabsContent value="methods">
            <InvestmentMethodsView
              methods={data.methods}
              ownedMethodIds={ownedMethodIds}
              allocations={data.methodAllocations}
              capital={methodCapital}
              hideValues={hideValues}
              onEditMethod={setEditingMethod}
            />
          </TabsContent>
        </Tabs>
        <AddTransactionDialog
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          methods={enabledMethods}
          onSubmit={handleAddTransaction}
          isAdmin={data.isAdmin}
          users={data.users}
        />
      </>
    );
  }

  const stats = data.stats;

  // Only investors see this one; owners get the margin chart instead.
  const chartSeries = data.chartData;

  const performanceChart =
    chartSeries.length > 0 ? (
      <PerformanceChart
        data={chartSeries}
        cashFlows={data.cashFlows}
        hideValues={hideValues}
      />
    ) : (
      <EmptyState
        icon={ChartLine}
        title="Not enough data for the chart"
        description="Approve transactions or capture a snapshot to seed history."
        className="h-96"
      />
    );

  const hasTransactions = data.transactions.length > 0;
  const pendingCount = data.transactions.filter((t) => t.status === "pending").length;
  const exportLabel = (
    <>
      <Download /> Export CSV
    </>
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* All transient controls (charts toggle, snapshots, destructive admin
            ops) live in the dev drawer; the header keeps what a reader uses. */}
        <PageHeader
          size="compact"
          title={data.portfolio.name}
          badge={<Badge variant="secondary">Default</Badge>}
          description="Snapshot of every approved buy and withdrawal across your investment methods."
          actions={
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={hideValues ? "Show values" : "Hide values"}
                    aria-pressed={hideValues}
                    onClick={() => setHideValues((v) => !v)}
                  >
                    {hideValues ? <EyeOff /> : <Eye />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{hideValues ? "Show values" : "Hide values"}</TooltipContent>
              </Tooltip>

              {/* A plain link, not a fetch + blob: the browser handles the
                  download natively and the route's Content-Disposition names
                  the file. Disabled with no rows so it can't hand back a
                  header-only CSV — wrapped in a focusable span so the reason
                  still shows on hover and focus. */}
              {hasTransactions ? (
                <Button asChild variant="outline">
                  <a href="/api/portfolio/export" download>
                    {exportLabel}
                  </a>
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button variant="outline" disabled>
                        {exportLabel}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>No transactions to export yet</TooltipContent>
                </Tooltip>
              )}
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus /> Add transaction
              </Button>
            </>
          }
        />

        <Tabs defaultValue="overview" className="gap-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="methods">Methods</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-6">
            {/* Owners and investors need different headlines. An investor's
                portfolio value IS their position. An owner's "portfolio value"
                is the sum of what they OWE, so showing it as the headline made
                a badly underwater book read as growth. */}
            {ownsMethods ? (
              ownerKpis === null ? (
                // Nothing has moved through the methods yet. Four "$0.00"
                // cards and a "100%" read like a result; this is a start.
                <EmptyState
                  variant="card"
                  icon={Wallet}
                  title="No money in your methods yet"
                  description="Once a contribution to one of your methods is approved — yours or an investor's — what it bought and what you owe appear here."
                  action={
                    <Button onClick={() => setIsDialogOpen(true)}>
                      <Plus /> Add transaction
                    </Button>
                  }
                />
              ) : (
                <>
                  {data.marginStatus.unpriced > 0 && !data.marginStatus.unconfigured && (
                    <Alert variant="warning">
                      <CircleDashed />
                      <AlertDescription>
                        {data.marginStatus.unpriced === 1
                          ? "1 approved contribution is not priced yet, so Allocations today and Margin leave it out until the daily price run values it."
                          : `${data.marginStatus.unpriced} approved contributions are not priced yet, so Allocations today and Margin leave them out until the daily price run values them.`}
                      </AlertDescription>
                    </Alert>
                  )}
                  <OwnerKpiGrid
                    kpis={ownerKpis}
                    priced={!data.marginStatus.unconfigured}
                    hideValues={hideValues}
                  />
                </>
              )
            ) : stats && hasSettledMoney(stats) ? (
              <PortfolioKpiGrid
                stats={stats}
                hideValues={hideValues}
                onToggleHideValues={() => setHideValues((v) => !v)}
                sparkline={data.chartData}
              />
            ) : (
              <EmptyState
                variant="card"
                icon={Wallet}
                title={
                  pendingCount > 0 ? "Waiting for approval" : "Your portfolio is empty"
                }
                description={
                  pendingCount > 0
                    ? `${pendingCount === 1 ? "Your first transaction is" : `${pendingCount} transactions are`} waiting for an admin. Your balance and performance appear once one is approved.`
                    : "Pick an investment method and add your first transaction."
                }
                action={
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus /> Add transaction
                  </Button>
                }
              />
            )}

            {/* Exactly one chart. Owners get allocations against what is owed —
                the gap between the two lines is the margin. Everyone else gets
                the ordinary performance chart. */}
            {ownsMethods ? (
              ownerKpis !== null && (
                <>
                  {showCharts && (
                    <Card>
                      <CardContent>
                        {data.marginStatus.unconfigured ? (
                          // With nothing priced, Allocations is a flat zero
                          // under the owed line — which reads as a total loss.
                          <EmptyState
                            icon={ChartLine}
                            title="Nothing is priced yet"
                            description="Set where each method's money goes (Methods tab, edit a method). The daily price run then values every contribution at its day's price."
                          />
                        ) : (
                          <MarginChart
                            input={data.marginHistoryInput}
                            hideValues={hideValues}
                          />
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {data.investorBreakdown.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <Heading level="h5" as="h2" className="text-muted-foreground">
                          By person
                        </Heading>
                        <Text variant="small">
                          What each investor put in, what it bought, and what the
                          promise costs you.
                        </Text>
                      </div>
                      <InvestorBreakdown
                        rows={data.investorBreakdown}
                        hideValues={hideValues}
                      />
                    </div>
                  )}
                </>
              )
            ) : (
              stats && hasSettledMoney(stats) && showCharts && performanceChart
            )}
          </TabsContent>

          <TabsContent value="transactions" className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Text variant="small">
                {detailedTransactions
                  ? "Every movement, including pending and rejected."
                  : `Approved movements only${
                      visibleRows.hiddenCount > 0
                        ? ` · ${visibleRows.hiddenCount} hidden`
                        : ""
                    }`}
              </Text>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailedTransactions((v) => !v)}
              >
                <ListFilter />
                {detailedTransactions ? "Simple view" : "Detailed view"}
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {ownsMethods && (
                <Heading level="h5" as="h2" className="text-muted-foreground">
                  Yours
                </Heading>
              )}
              <Card>
                <CardContent>
                  <TransactionsTable
                    rows={visibleRows.own}
                    showStatus={detailedTransactions}
                    showPositions={ownsMethods}
                    balanceLabel="Balance"
                    hideValues={hideValues}
                  />
                </CardContent>
              </Card>
            </div>

            {ownsMethods && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Heading level="h5" as="h2" className="text-muted-foreground">
                    Investors
                  </Heading>
                  <Text variant="small">
                    One line per person investing in the methods you run.
                  </Text>
                </div>
                <Card>
                  <CardContent>
                    <InvestorSummaryTable
                      rows={investorSummary}
                      hideValues={hideValues}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* The deep view of the methods catalogue, folded in from what used
              to be its own /portal/investment-methods page. */}
          <TabsContent value="methods">
            <InvestmentMethodsView
              methods={data.methods}
              ownedMethodIds={ownedMethodIds}
              allocations={data.methodAllocations}
              capital={methodCapital}
              hideValues={hideValues}
              onEditMethod={setEditingMethod}
            />
          </TabsContent>
        </Tabs>
      </div>

      {editingMethod && (
        <MethodEditorDialog
          method={editingMethod}
          allocations={
            data.methodAllocations.find((a) => a.methodId === editingMethod.id)
              ?.allocations ?? []
          }
          onEditAllocation={() => {
            setAllocatingMethod(editingMethod);
            setEditingMethod(null);
          }}
          onClose={() => setEditingMethod(null)}
        />
      )}

      {allocatingMethod && (
        <AllocationDialog
          open
          methodId={allocatingMethod.id}
          methodName={allocatingMethod.name}
          assets={data.priceAssets}
          initial={
            data.methodAllocations.find((a) => a.methodId === allocatingMethod.id)
              ?.allocations ?? []
          }
          onClose={() => setAllocatingMethod(null)}
        />
      )}

      <AddTransactionDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        methods={enabledMethods}
        onSubmit={handleAddTransaction}
        isAdmin={data.isAdmin}
        users={data.users}
        adminUserId={data.currentUserId}
      />

      {data.isAdmin && (
        <ManualSnapshotDialog
          open={isSnapshotDialogOpen}
          onOpenChange={setIsSnapshotDialogOpen}
        />
      )}

      {data.isAdmin && (
        <AlertDialog
          open={isClearDialogOpen}
          onOpenChange={(open) => !isClearing && setIsClearDialogOpen(open)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear manual snapshots</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes every manual snapshot from every
                portfolio, not only yours. Snapshots created by the system, by
                transaction approvals or marked admin enforce stay intact.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
              {/* preventDefault keeps the dialog open until the delete settles:
                  Radix closes on click, which hid the pending label and let a
                  failure arrive with no dialog to show it in. */}
              <AlertDialogAction
                variant="destructive"
                onClick={(e) => {
                  e.preventDefault();
                  void handleClearSnapshots();
                }}
                disabled={isClearing}
              >
                {isClearing && <Spinner />}
                {isClearing ? "Clearing…" : "Clear all manual snapshots"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

/** Any approved money at all — otherwise the KPI grid is four zeros. */
function hasSettledMoney(stats: PortfolioStats): boolean {
  return stats.costBasis > 0 || stats.totalWithdrawn > 0 || stats.activeTransactions > 0;
}

function PortfolioKpiGrid({
  stats,
  hideValues,
  onToggleHideValues,
  sparkline,
}: {
  stats: PortfolioStats;
  hideValues: boolean;
  onToggleHideValues: () => void;
  /** Value history behind the headline figure — drawn as a bare trend line,
   *  no axes, so the number carries a direction without a second chart. */
  sparkline: ChartDataPoint[];
}) {
  const profitTone = stats.allTimeProfit >= 0 ? "positive" : "negative";
  const profitSublabel = (
    <span className={cn("font-medium", statToneClass(profitTone))}>
      {stats.allTimeProfit >= 0 ? "up" : "down"}{" "}
      {formatPercent(Math.abs(stats.allTimeProfitPercentage))}
    </span>
  );

  return (
    <div className="@container">
      {/* Columns follow the width the grid actually has, not the viewport: at
         1024px the sidebar leaves ~670px, and four cards there clipped every
         figure mid-number. */}
      <div className="grid gap-4 @md:grid-cols-2 @4xl:grid-cols-4">
        <StatCard
          label="Total value"
          value={
            hideValues
              ? maskValue(formatCurrency(stats.totalValue))
              : formatCurrency(stats.totalValue)
          }
          tone="positive"
          sublabel="Your balance, interest included"
          chart={<Sparkline data={sparkline} />}
          action={
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              onClick={onToggleHideValues}
              aria-label={hideValues ? "Show portfolio values" : "Hide portfolio values"}
              aria-pressed={hideValues}
            >
              {hideValues ? <EyeOff /> : <Eye />}
            </Button>
          }
        />
        <StatCard
          label="All-time profit"
          value={
            hideValues
              ? formatSignedPercent(stats.allTimeProfitPercentage)
              : formatSignedCurrency(stats.allTimeProfit)
          }
          tone={profitTone}
          sublabel={hideValues ? "All-time return" : profitSublabel}
        />
        <StatCard
          label="Cost basis"
          value={
            hideValues
              ? maskValue(formatCurrency(stats.costBasis))
              : formatCurrency(stats.costBasis)
          }
          sublabel="Total invested"
        />
        <StatCard
          label="Active positions"
          value={String(stats.activeTransactions)}
          sublabel={`${stats.totalInvestmentMethods} method${
            stats.totalInvestmentMethods === 1 ? "" : "s"
          }`}
        />
      </div>
    </div>
  );
}
