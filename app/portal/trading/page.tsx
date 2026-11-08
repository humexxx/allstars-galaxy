import type { Metadata } from "next";

import { TradingJournalView } from "@/components/finance/trading/trading-journal-view";
import { parseJournalView } from "@/lib/finance/journal-view";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getTradingJournal } from "@/lib/services/trading-journal-service";
import { getRequestTimeZone } from "@/lib/utils/request-today";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Trading journal" };

export default async function TradingJournalPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}): Promise<React.ReactElement> {
  const ctx = await requireEffectiveContext();
  const [journal, { view }] = await Promise.all([
    getTradingJournal(ctx.effectiveUserId, await getRequestTimeZone()),
    searchParams,
  ]);
  return <TradingJournalView journal={journal} initialView={parseJournalView(view)} />;
}
