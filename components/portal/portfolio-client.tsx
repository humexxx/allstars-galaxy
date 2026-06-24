"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Camera, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Heading, Mono, Text } from "@/components/ui/typography";
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
    return (
      <>
        <EmptyPortfolio onAddTransaction={() => setIsDialogOpen(true)} />
        <AddTransactionDialog
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          methods={data.methods}
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
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add transaction
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
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
        </Tabs>
      </div>

      <AddTransactionDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        methods={data.methods}
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
    <span className={cn("font-medium", toneClass(profitTone))}>
      {stats.allTimeProfit >= 0 ? "up" : "down"}{" "}
      {formatPercent(Math.abs(stats.allTimeProfitPercentage))}
    </span>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <PortfolioKpiCard
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
      <PortfolioKpiCard
        label="All-time profit"
        value={hideValues ? "****" : formatSignedCurrency(stats.allTimeProfit)}
        tone={profitTone}
        sublabel={profitSublabel}
      />
      <PortfolioKpiCard
        label="Cost basis"
        value={hideValues ? "****" : formatCurrency(stats.costBasis)}
        sublabel="Total invested"
      />
      <PortfolioKpiCard
        label="Active positions"
        value={String(stats.activeTransactions)}
        sublabel={`${stats.totalInvestmentMethods} method${
          stats.totalInvestmentMethods === 1 ? "" : "s"
        }`}
      />
    </div>
  );
}

function PortfolioKpiCard({
  label,
  value,
  sublabel,
  tone,
  action,
}: {
  label: string;
  value: string;
  sublabel?: React.ReactNode;
  tone?: "positive" | "negative";
  action?: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-1">
        <Mono className={cn("block text-xl font-semibold tabular-nums sm:text-2xl", toneClass(tone))}>
          {value}
        </Mono>
        {sublabel && (
          <Text variant="small" as="div">{sublabel}</Text>
        )}
      </CardContent>
    </Card>
  );
}

function toneClass(tone?: "positive" | "negative"): string {
  if (tone === "positive") return "text-emerald-600 dark:text-emerald-400";
  if (tone === "negative") return "text-rose-600 dark:text-rose-400";
  return "";
}
