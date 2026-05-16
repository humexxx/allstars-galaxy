import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusCircle, Wallet } from "lucide-react";

export function EmptyPortfolio({ onAddTransaction }: { onAddTransaction: () => void }) {
  return (
    <EmptyState
      variant="card"
      icon={Wallet}
      title="Your portfolio is empty"
      description="Start tracking your crypto investments by adding your first transaction"
      action={
        <Button onClick={onAddTransaction} size="lg" className="w-full">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      }
    />
  );
}
