import { db } from "@/db";
import { investmentMethods } from "@/db/schema";
import type { Metadata } from "next";
import {
  getUserPortfolio,
  getPortfolioStats,
  getPortfolioTransactions,
  getMethodInvestors,
  getManagedCapitalSeries,
} from "@/lib/services/portfolio-service";
import { getPortfolioPerformanceData } from "@/lib/services/chart-service";
import { getAllUsers } from "@/lib/services/user-service";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import type { PortfolioTransaction } from "@/types/portfolio";
import PortfolioClientPage from "@/components/portal/portfolio-client";
import { PortalPageContainer } from "@/components/portal/page-container";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "View and manage your investment portfolio",
};

export default async function PortfolioPage() {
  const ctx = await requireEffectiveContext();
  const isAdmin = ctx.realRole === "admin";

  // When impersonating, show the impersonated user's portfolio. Otherwise show the real user's.
  const userId = ctx.effectiveUserId;

  const usersPromise = isAdmin ? getAllUsers() : Promise.resolve([]);
  // Only meaningful for someone who runs methods; everyone else gets [] and
  // never sees the tab.
  const investorsPromise = getMethodInvestors(userId);
  const managedPromise = getManagedCapitalSeries(userId);
  const [portfolio, methods, users, methodInvestors, managedCapital] =
    await Promise.all([
    getUserPortfolio(userId),
    // ALL methods, enabled or not: the Methods tab renders
    // InvestmentMethodsView, which filters to enabled itself and exposes a dev
    // toggle for the disabled ones. Consumers that only want the live set
    // (the transaction form) filter below.
    db.select().from(investmentMethods),
    usersPromise,
      investorsPromise,
      managedPromise,
    ]);

  let stats = null;
  let transactions: PortfolioTransaction[] = [];
  let chartData: { date: string; value: number }[] = [];

  if (portfolio) {
    [stats, transactions, chartData] = await Promise.all([
      getPortfolioStats(portfolio.id),
      getPortfolioTransactions(portfolio.id),
      getPortfolioPerformanceData(portfolio.id, "All"),
    ]);

    // Fallback: build chart from approved transactions if no snapshots exist.
    if (chartData.length === 0) {
      const approvedTransactions = transactions.filter((t) => t.status === "approved");
      if (approvedTransactions.length > 0) {
        let runningTotal = 0;
        chartData = approvedTransactions.map((t) => {
          runningTotal += t.type === "buy" ? parseFloat(t.total) : -parseFloat(t.total);
          return { date: new Date(t.date).toISOString(), value: runningTotal };
        });
      }
    }
  }

  const data = {
    portfolio,
    stats,
    transactions,
    chartData,
    methods,
    isAdmin,
    users,
    methodInvestors,
    managedCapital,
    currentUserId: userId,
  };

  return (
    <PortalPageContainer>
      <PortfolioClientPage data={data} />
    </PortalPageContainer>
  );
}
