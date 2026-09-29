import type { Metadata } from "next";
import { getAdminTransactions } from "@/lib/services/admin-service";
import { DataTable } from "@/components/admin/transactions/data-table";
import { TransactionFilters } from "@/components/admin/transactions/filters";
import { requireAdminOrRedirect } from "@/lib/services/auth-server";
import { PageHeader } from "@/components/portal/page-header";
import { adminTransactionFiltersSchema } from "@/schemas/admin";

export const metadata: Metadata = {
  title: "Transaction management",
  description: "Approve or reject user transactions and manage investment requests",
};

type AdminTransactionsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AdminTransactionsPage({
  searchParams,
}: AdminTransactionsPageProps) {
  await requireAdminOrRedirect();

  // Every field falls back instead of failing, so this cannot throw — and a
  // partial id never reaches `users.id = $1`, where Postgres would reject it.
  const filters = adminTransactionFiltersSchema.parse(await searchParams);
  const data = await getAdminTransactions(filters);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Transaction management"
        description="Approve or reject transactions. Filter by user, status, or type."
      />
      <TransactionFilters />
      <DataTable data={data} />
    </section>
  );
}
