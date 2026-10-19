import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import type { AdminTransactionRow } from "@/types/transaction";
import { TransactionRow } from "./transaction-row";

interface DataTableProps {
  data: AdminTransactionRow[];
  /** The default view is the approval queue, and an empty queue is good
   *  news — not "nothing matches". */
  queue?: boolean;
}

export function DataTable({ data, queue = false }: DataTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title={queue ? "Nothing waiting for approval" : "Nothing in this view"}
            description={
              queue
                ? "New buys and withdrawal requests land here."
                : "No transactions match the current filters."
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {/* Sized by the card: the queue sits beside the sidebar on a tablet and
          full-width on a phone, and below the width seven columns need it is
          a list — the amount and the approve buttons stay on screen. */}
      <CardContent className="@container">
        <ul className="flex flex-col divide-y @3xl:hidden">
          {data.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} layout="card" />
          ))}
        </ul>
        <div className="hidden @3xl:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type · method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Processed by</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
