import { getAdminTransactions } from "@/lib/services/admin-service";
import { DataTable } from "@/components/admin/transactions/data-table";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transaction Management | Capital Galaxy",
  description: "Approve or reject user transactions and manage investment requests",
};
import { TransactionFilters } from "@/components/admin/transactions/filters";
import { requireAdminCached } from "@/lib/services/auth-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic"; // Ensure fresh data

export default async function AdminTransactionsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    // Auth Check - will throw if not admin
    try {
        await requireAdminCached();
    } catch {
        redirect("/portal");
    }

    // Parse filters
    const params = await searchParams;
    const userId = typeof params.userId === "string" ? params.userId : undefined;
    
    // If no status param, default to pending. If status is explicitly in URL, use it (or undefined for "all")
    let status: "pending" | "approved" | "rejected" | undefined;
    if (params.status === undefined) {
        status = "pending"; // Default when first loading the page
    } else if (typeof params.status === "string" && ["pending", "approved", "rejected"].includes(params.status)) {
        status = params.status as "pending" | "approved" | "rejected";
    } else {
        status = undefined; // For "all" or any other value
    }
    
    const type = typeof params.type === "string" && ["buy", "withdrawal"].includes(params.type)
        ? (params.type as "buy" | "withdrawal")
        : undefined;

    const data = await getAdminTransactions({
        userId,
        status,
        type,
    });

    return (
        <section className="space-y-6">
            <header className="space-y-2">
                <h1 className="text-2xl font-bold">Transaction Management</h1>
                <p className="text-muted-foreground">
                    Approve or reject transactions. Filter by user, status, or type.
                </p>
            </header>

            <TransactionFilters />
            <DataTable data={data} />
        </section>
    );
}
