"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatSignedCurrency, formatSignedPercent } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/empty-state";
import type { PortfolioAsset } from "@/types/portfolio";

type PortfolioAssetsTableProps = {
  assets: PortfolioAsset[];
};

export function PortfolioAssetsTable({ assets }: PortfolioAssetsTableProps) {
  if (assets.length === 0) {
    return (
      <EmptyState
        title="No assets yet"
        description="Add your first transaction to get started."
      />
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Holdings</TableHead>
            <TableHead>Avg Buy Price</TableHead>
            <TableHead>Profit/Loss</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => {
            const profitTone = asset.profitLoss >= 0 ? "text-green-500" : "text-red-500";

            return (
              <TableRow key={asset.investmentMethod.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-sm font-semibold text-primary">
                        {asset.investmentMethod.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{asset.investmentMethod.name}</span>
                        {asset.hasPendingTransactions && (
                          <Badge variant="outline" className="text-xs">
                            Pending
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {asset.investmentMethod.author}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    {asset.holdingAmount > 0 && (
                      <>
                        <span className="font-medium">{formatCurrency(asset.holdingAmount)}</span>
                        <span className="text-xs text-muted-foreground">
                          {asset.investmentMethod.monthlyRoi}% Monthly ROI
                        </span>
                      </>
                    )}
                    {asset.pendingAmount > 0 && asset.holdingAmount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        +{formatCurrency(asset.pendingAmount)} pending
                      </span>
                    )}
                    {asset.holdingAmount === 0 && asset.pendingAmount > 0 && (
                      <>
                        <span className="font-medium text-muted-foreground">
                          {formatCurrency(asset.pendingAmount)}
                        </span>
                        <span className="text-xs text-muted-foreground">Awaiting approval</span>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>{formatCurrency(asset.totalInvested)}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className={profitTone}>{formatSignedCurrency(asset.profitLoss)}</span>
                    <span className={`text-xs ${profitTone}`}>
                      {formatSignedPercent(asset.profitLossPercentage)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Actions for ${asset.investmentMethod.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
