"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Camera, Download, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InvestmentMethodsView } from "@/components/portfolio/investment-methods-view";
import { MethodInvestorsView } from "@/components/portfolio/method-investors";
import { ManagedCapitalCard } from "@/components/portfolio/managed-capital";
import type { ManagedContribution } from "@/lib/finance/managed-capital";
import { StatCard, statToneClass } from "@/components/ui/stat-card";
import { Heading, Text } from "@/components/ui/typography";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
} from "@/lib/utils/format";

import { AddTransactionDialog } from "@/components/portfolio/add-transaction-dialog";
import { EmptyPortfolio } from "@/components/portfolio/empty-portfolio";
import { ManualSnapshotDialog } from "@/components/portfolio/manual-snapshot-dialog";
import { TransactionsTable } from "@/components/portfolio/transactions-table";
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
import type {
  InvestmentMethod,
  Portfolio,
  PortfolioStats,
  PortfolioTransaction,
  MethodInvestors,
} from "@/types/portfolio";

type ChartDataPoint = {
  date: string;
  value: number;
};

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
  methods: InvestmentMethod[];
  isAdmin: boolean;
  users?: User[];
  /** Methods this user owns + who holds money in them. Empty for everyone
   *  who doesn't run any. Never folded into the portfolio totals. */
  methodInvestors: MethodInvestors[];
  /** Approved buys across the methods this user runs, own and third-party.
   *  Raw rows so the card can filter by method/investor in the browser. */
  managedContributions: ManagedContribution[];
  currentUserId: string;
};

const PerformanceChart = dynamic(
  () =>
    import("@/components/portfolio/performance-chart").then(
      (mod) => mod.PerformanceChart
    ),
  {
    ssr: false,
    loading: () => (
      <Card className="flex h-96 items-center justify-center bg-card">
        <Text variant="muted" className="text-sm">
          Loading chart…
        </Text>
      </Card>
    ),
  }
);

export default function PortfolioClientPage({ data }: { data: PortfolioData }) {
  const router = useRouter();
  // The transaction form only ever offered live methods; the Methods tab gets
  // the full list because it filters (and can reveal disabled) itself.
  // The Investors tab only exists for people who actually run methods.
  const ownsMethods = data.methodInvestors.length > 0;

  const enabledMethods = useMemo(
    () => data.methods.filter((m) => m.enabled),
    [data.methods]
  );

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
      description: "Hide the performance chart on the overview tab.",
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
  const manualSnapshotTool = useMemo(
    () =>
      data.isAdmin
        ? {
            id: "portfolio:manual-snapshot",
            kind: "action" as const,
            label: "Manual snapshot",
            description: "Record the portfolio's current value as a snapshot.",
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
            description: "Delete every manually-created snapshot. System ones stay.",
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
    const result = await createTransactionAction(transactionData);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    const transaction = result.data;
    if (data.isAdmin && transaction?.status === "approved") {
      toast.success("Transaction added and approved successfully");
    } else {
      toast.success("Transaction added successfully");
    }
    router.refresh();
    return true;
  };

  const handleClearSnapshots = async (): Promise<void> => {
    try {
      setIsClearing(true);
      await deleteManualSnapshotsAction();
      toast.success("Manual snapshots deleted successfully");
      router.refresh();
    } catch {
      toast.error("Error deleting snapshots");
    } finally {
      setIsClearing(false);
      setIsClearDialogOpen(false);
    }
  };

  if (!data.portfolio) {
    // No portfolio yet — but the methods catalogue used to be its own page and
    // needs nothing from a portfolio, so it stays reachable. Browsing methods
    // is exactly what you do BEFORE you have one.
    return (
      <>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="methods">Methods</TabsTrigger>
            {ownsMethods && (
              <TabsTrigger value="investors">Investors</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="overview">
            <EmptyPortfolio onAddTransaction={() => setIsDialogOpen(true)} />
          </TabsContent>
          <TabsContent value="methods">
            <InvestmentMethodsView methods={data.methods} />
          </TabsContent>

          {ownsMethods && (
            <TabsContent value="investors">
              <MethodInvestorsView methods={data.methodInvestors} />
            </TabsContent>
          )}
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

  return (
    <>
      <div className="space-y-6">
        {/* Header: title + description on the left, primary action on the
            right. Mirrors plan-editor's PageHeader idiom (Heading h3 bold +
            muted Text). All transient controls (charts toggle, snapshots,
            destructive admin ops) moved into the dev drawer. */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Heading level="h3" className="font-semibold">
                {data.portfolio.name}
              </Heading>
              <Badge variant="secondary" className="text-xs">
                Default
              </Badge>
            </div>
            <Text variant="muted">
              Snapshot of every approved buy and withdrawal across your
              investment methods.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            {/* A plain link, not a fetch + blob: the browser handles the
                download natively and the route's Content-Disposition names the
                file. Disabled with no rows so it can't hand back a header-only
                CSV. */}
            <Button
              asChild={data.transactions.length > 0}
              variant="outline"
              disabled={data.transactions.length === 0}
              title={
                data.transactions.length === 0
                  ? "No transactions to export yet"
                  : undefined
              }
            >
              {data.transactions.length > 0 ? (
                <a href="/api/portfolio/export" download>
                  <Download className="mr-1 h-4 w-4" /> Export CSV
                </a>
              ) : (
                <span>
                  <Download className="mr-1 h-4 w-4" /> Export CSV
                </span>
              )}
            </Button>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add transaction
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="methods">Methods</TabsTrigger>
            {ownsMethods && (
              <TabsTrigger value="investors">Investors</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Owners get the own-vs-managed split first: it frames every
                figure below it, which are theirs alone. */}
            {ownsMethods && <ManagedCapitalCard contributions={data.managedContributions} />}
            {stats && (
              <PortfolioKpiGrid
                stats={stats}
                hideValues={hideValues}
                onToggleHideValues={() => setHideValues((v) => !v)}
              />
            )}

            {showCharts && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-3">
                  {data.chartData.length > 0 ? (
                    <PerformanceChart data={data.chartData} />
                  ) : (
                    <Card className="flex h-96 items-center justify-center bg-card">
                      <div className="text-center">
                        <Text variant="muted">Not enough data for the chart.</Text>
                        <Text variant="small" className="mt-1">
                          Approve transactions or capture a snapshot to seed history.
                        </Text>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="transactions">
            <Card className="bg-card">
              <CardContent className="p-0 sm:p-6">
                <TransactionsTable transactions={data.transactions} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* The deep view of the methods catalogue, folded in from what used
              to be its own /portal/investment-methods page. */}
          <TabsContent value="methods">
            <InvestmentMethodsView methods={data.methods} />
          </TabsContent>

          {ownsMethods && (
            <TabsContent value="investors">
              <MethodInvestorsView methods={data.methodInvestors} />
            </TabsContent>
          )}
        </Tabs>
      </div>

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
        <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear manual snapshots</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete every manual snapshot from your
                portfolio. Snapshots created by the system or through transaction
                approvals stay intact.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleClearSnapshots}
                disabled={isClearing}
              >
                {isClearing ? "Clearing…" : "Clear all manual snapshots"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

function PortfolioKpiGrid({
  stats,
  hideValues,
  onToggleHideValues,
}: {
  stats: PortfolioStats;
  hideValues: boolean;
  onToggleHideValues: () => void;
}) {
  const profitTone = stats.allTimeProfit >= 0 ? "positive" : "negative";
  const profitSublabel = (
    <span className={cn("font-medium", statToneClass(profitTone))}>
      {stats.allTimeProfit >= 0 ? "up" : "down"}{" "}
      {formatPercent(Math.abs(stats.allTimeProfitPercentage))}
    </span>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total value"
        value={hideValues ? "****" : formatCurrency(stats.totalValue)}
        tone="positive"
        sublabel="Current market value"
        action={
          <button
            type="button"
            onClick={onToggleHideValues}
            className="text-muted-foreground transition hover:text-foreground"
            aria-label={hideValues ? "Show portfolio values" : "Hide portfolio values"}
            aria-pressed={hideValues}
          >
            {hideValues ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        }
      />
      <StatCard
        label="All-time profit"
        value={hideValues ? "****" : formatSignedCurrency(stats.allTimeProfit)}
        tone={profitTone}
        sublabel={profitSublabel}
      />
      <StatCard
        label="Cost basis"
        value={hideValues ? "****" : formatCurrency(stats.costBasis)}
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
  );
}
