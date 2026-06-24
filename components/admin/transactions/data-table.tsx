"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import type { AdminTransactionRow } from "@/types/transaction";
import { TransactionRow } from "./transaction-row";

interface DataTableProps {
    data: AdminTransactionRow[];
}

export function DataTable({ data }: DataTableProps) {
    return (
        <div className="rounded-md border">
            <div className="w-full overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Processed By</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length > 0 ? (
                        data.map((transaction) => (
                            <TransactionRow key={transaction.id} transaction={transaction} />
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                <Text variant="muted">
                                    No transactions match the current filters.
                                </Text>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            </div>
        </div>
    );
}
