import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getUserPortfolio,
  getPortfolioStats,
  getPortfolioTransactions,
  getMethodInvestors,
  getInvestorTransactions,
} from "@/lib/services/portfolio-service";
import { getPortfolioPerformanceData } from "@/lib/services/chart-service";
import { getManagedOverview } from "@/lib/services/margin-service";
import { getAllocationsByTransaction } from "@/lib/services/allocation-service";
import { listAllInvestmentMethods } from "@/lib/services/investment-method-service";
import {
  getHeldQuotes,
  getLatestPrices,
  listPriceAssets,
  priceCronSchedule,
} from "@/lib/services/price-service";
import { getAllUsers } from "@/lib/services/user-service";
import { requireModulePage } from "@/lib/services/module-access-service";
import type { ChartDataPoint } from "@/types/chart";
import type { PortfolioStats, PortfolioTransaction } from "@/types/portfolio";
import { getRequestTodayIso } from "@/lib/utils/request-today";
import PortfolioClientPage from "@/components/portal/portfolio-client";
import { performanceSeries } from "@/components/portfolio/performance-series";
import { ModuleMascot } from "@/components/portal/module-mascot";
import { PortalPageContainer } from "@/components/portal/page-container";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "View and manage your investment portfolio",
};

const EMPTY_STATS: PortfolioStats = {
  totalValue: 0,
  costBasis: 0,
  totalWithdrawn: 0,
  allTimeProfit: 0,
  allTimeProfitPercentage: 0,
  totalInvestmentMethods: 0,
  activeTransactions: 0,
};

export default async function PortfolioPage() {
  const ctx = await requireModulePage("portfolio");
  // As the transaction actions decide it: while impersonating, the admin acts
  // as that account, so no picker for putting money in for someone else.
  const isAdmin = ctx.realRole === "admin" && !ctx.isImpersonating;

  // When impersonating, show the impersonated user's portfolio. Otherwise show the real user's.
  const userId = ctx.effectiveUserId;

  const usersPromise = isAdmin ? getAllUsers() : Promise.resolve([]);
  // Only meaningful for someone who runs methods; everyone else gets [] and
  // never sees the tab.
  const investorsPromise = getMethodInvestors(userId);
  // Everything the Managed tab needs in one call. It used to be three
  // independent loaders that each re-queried the same methods, allocations and
  // quotes — eleven round trips against a pooler where a connection costs
  // ~850ms and a query ~86ms, which is what made this page take seconds.
  const managedOverviewPromise = getManagedOverview(userId);
  const investorTxPromise = getInvestorTransactions(userId);
  const priceAssetsPromise = listPriceAssets();
  // The prices behind the owner's margin, and how old they are. Empty for
  // anyone who runs no method: an investor's value is a fixed return.
  const heldQuotesPromise = getHeldQuotes(userId);
  const [
    portfolio,
    methods,
    users,
    methodInvestors,
    managedOverview,
    priceAssets,
    investorTransactions,
    heldQuotes,
  ] = await Promise.all([
    getUserPortfolio(userId),
    // ALL methods, enabled or not: the Methods tab renders
    // InvestmentMethodsView, which filters to enabled itself and exposes a dev
    // toggle for the disabled ones. Consumers that only want the live set
    // (the transaction form) filter below.
    listAllInvestmentMethods(userId),
    usersPromise,
    investorsPromise,
    managedOverviewPromise,
    priceAssetsPromise,
    investorTxPromise,
    heldQuotesPromise,
  ]);

  let stats = null;
  let transactions: PortfolioTransaction[] = [];
  let chartData: ChartDataPoint[] = [];

  if (portfolio) {
    [stats, transactions, chartData] = await Promise.all([
      getPortfolioStats(portfolio.id),
      getPortfolioTransactions(portfolio.id),
      getPortfolioPerformanceData(portfolio.id, "All"),
    ]);
    chartData = performanceSeries(chartData, transactions, stats.totalValue, new Date());
  }
  // A portfolio with nothing in it yet is the same page at zero: the figures
  // read $0.00 and the chart is a flat line from the month's start to today.
  if (chartData.length === 0) {
    const today = await getRequestTodayIso();
    chartData = [`${today.slice(0, 7)}-01`, today].map((day) => ({
      date: new Date(`${day}T00:00:00Z`).toISOString(),
      value: 0,
    }));
  }

  // Positions are the owner's private half of a method: a client is sold the
  // fixed return, and where the pooled money actually goes never reaches
  // their screen. Allocations therefore only travel for methods this user
  // runs — their own rows elsewhere carry none.
  const ownedMethodIds = new Set(methodInvestors.map((m) => m.methodId));

  // Both tables render the same shape, so the allocation lookup is one query
  // covering every transaction on the page — the owner's and their investors'.
  const allTxIds = [
    ...transactions
      .filter((t) => ownedMethodIds.has(t.investmentMethod.id))
      .map((t) => t.id),
    ...investorTransactions.map((t) => t.id),
  ];
  const [allocationsByTx, latestPrices] = await Promise.all([
    getAllocationsByTransaction(allTxIds),
    getLatestPrices(priceAssets.map((a) => a.id)),
  ]);
  const priceBySymbol = new Map(
    priceAssets.map((a) => [a.symbol, latestPrices.get(a.id) ?? null])
  );
  const withPrices = (txId: string) =>
    (allocationsByTx.get(txId) ?? []).map((a) => ({
      symbol: a.symbol,
      quantity: a.quantity,
      invested: a.invested,
      priceAtPurchase: a.priceAtPurchase,
      price: priceBySymbol.get(a.symbol) ?? null,
    }));

  // A buy's stored value is net of what was withdrawn from it; the table adds
  // that back so a withdrawal does not read as the investment losing money.
  const withdrawnFrom = new Map<string, number>();
  for (const t of [...transactions, ...investorTransactions]) {
    if (t.type !== "withdrawal" || t.status !== "approved" || !t.sourceTransactionId) continue;
    withdrawnFrom.set(
      t.sourceTransactionId,
      (withdrawnFrom.get(t.sourceTransactionId) ?? 0) + parseFloat(t.total)
    );
  }

  const data = {
    portfolio,
    stats: stats ?? EMPTY_STATS,
    transactions,
    chartData,
    cashFlows: transactions
      .filter((t) => t.status === "approved" || t.status === "closed")
      .map((t) => ({
        date: new Date(t.date).toISOString(),
        amount: (t.type === "withdrawal" ? -1 : 1) * parseFloat(t.total),
      })),
    methods,
    isAdmin,
    users,
    methodInvestors,
    methodAllocations: managedOverview.allocations,
    marginHistory: managedOverview.history,
    marginHistoryInput: managedOverview.historyInput,
    marginStatus: {
      unconfigured: managedOverview.overview.unconfigured,
      unpriced: managedOverview.overview.unpriced,
    },
    investorBreakdown: managedOverview.investors,
    transactionRows: transactions.map((t) => ({
      id: t.id,
      date: new Date(t.date).toISOString(),
      methodName: t.investmentMethod.name,
      type: t.type,
      status: t.status,
      total: t.total,
      initialValue: t.initialValue,
      currentValue: t.currentValue,
      withdrawn: withdrawnFrom.get(t.id),
      allocations: ownedMethodIds.has(t.investmentMethod.id) ? withPrices(t.id) : [],
    })),
    investorTransactions: investorTransactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      methodName: t.methodName,
      investorId: t.investorId,
      investorName: t.investorName,
      type: t.type,
      status: t.status,
      total: t.total,
      initialValue: t.initialValue,
      currentValue: t.currentValue,
      withdrawn: withdrawnFrom.get(t.id),
      allocations: withPrices(t.id),
    })),
    priceAssets: priceAssets.map((a) => ({
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      source: a.source,
    })),
    priceFreshness: {
      quotes: heldQuotes.map((q) => ({
        symbol: q.symbol,
        source: q.source,
        fetchedAt: q.fetchedAt?.toISOString() ?? null,
      })),
      schedule: priceCronSchedule(),
    },
    currentUserId: userId,
  };

  return (
    <PortalPageContainer>
      <PortfolioClientPage data={data} />
      <Suspense fallback={null}>
        <ModuleMascot variant="portfolio" />
      </Suspense>
    </PortalPageContainer>
  );
}

