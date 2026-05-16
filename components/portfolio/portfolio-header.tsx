"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Plus,
  Download,
  MoreHorizontal,
  Camera,
  Trash2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ManualSnapshotDialog } from "./manual-snapshot-dialog";
import { deleteManualSnapshotsAction } from "@/app/actions/portfolio-snapshots";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AdminOnly } from "@/components/admin-only";
import { formatCurrency } from "@/lib/utils/format";
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

type PortfolioHeaderProps = {
  portfolioName: string;
  totalValue: number;
  onAddTransaction: () => void;
  showCharts: boolean;
  onToggleCharts: () => void;
  hideValues: boolean;
  onToggleHideValues: () => void;
  isAdmin: boolean;
};

export function PortfolioHeader({
  portfolioName,
  totalValue,
  onAddTransaction,
  showCharts,
  onToggleCharts,
  hideValues,
  onToggleHideValues,
  isAdmin,
}: PortfolioHeaderProps) {
  const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDeleteSnapshots = async (): Promise<void> => {
    try {
      setIsDeleting(true);
      await deleteManualSnapshotsAction();
      toast.success("Manual snapshots deleted successfully");
      router.refresh();
    } catch {
      toast.error("Error deleting snapshots");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Left Side: Title and Balance */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground/90">
              {portfolioName}
            </h1>
            <Badge
              variant="secondary"
              className="text-xs px-2 py-0.5 rounded-md"
            >
              Default
            </Badge>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-4xl font-bold tracking-tight">
                {hideValues ? "****" : formatCurrency(totalValue)}
              </span>
              <button
                type="button"
                onClick={onToggleHideValues}
                className="focus:outline-none"
                aria-label={hideValues ? "Show portfolio balance" : "Hide portfolio balance"}
                aria-pressed={hideValues}
              >
                {hideValues ? (
                  <EyeOff className="w-5 h-5 text-muted-foreground cursor-pointer hover:text-foreground" />
                ) : (
                  <Eye className="w-5 h-5 text-muted-foreground cursor-pointer hover:text-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-end gap-3 flex-col">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-muted-foreground">Show charts</span>
              <Switch checked={showCharts} onCheckedChange={onToggleCharts} />
            </div>

            <Button onClick={onAddTransaction} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Transaction
            </Button>

            <Button variant="outline" className="gap-2 bg-background">
              <Download className="w-4 h-4" />
              Export
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="bg-background"
              aria-label="More portfolio actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
          <AdminOnly isAdmin={isAdmin}>
            <div className="flex items-center gap-3 bg-accent w-full p-2 rounded-md justify-end">
              <Button
                variant="outline"
                className="gap-2 bg-background"
                onClick={() => setIsSnapshotDialogOpen(true)}
              >
                <Camera className="w-4 h-4" />
                Manual Snapshot
              </Button>

              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4" />
                Clear Manual Snapshots
              </Button>
            </div>
          </AdminOnly>
        </div>
      </div>

      <ManualSnapshotDialog
        open={isSnapshotDialogOpen}
        onOpenChange={setIsSnapshotDialogOpen}
      />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Manual Snapshots</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all manual snapshots from your portfolio. 
              Snapshots created by the system or through transaction approvals will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={'destructive'}
              onClick={handleDeleteSnapshots}
              disabled={isDeleting}
            >
              {isDeleting ? "Clearing..." : "Clear All Manual Snapshots"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
