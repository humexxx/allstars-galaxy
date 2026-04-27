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

type InvestmentMethod = {
  id: string;
  name: string;
  author: string;
  riskLevel: string;
  monthlyRoi: number;
};

type Asset = {
  investmentMethod: InvestmentMethod;
  totalInvested: number;
  totalWithdrawn: number;
  holdingAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  hasPendingTransactions: boolean;
  profitLoss: number;
  profitLossPercentage: number;
};

type PortfolioAssetsTableProps = {
  assets: Asset[];
};

export function PortfolioAssetsTable({ assets }: PortfolioAssetsTableProps): React.ReactElement {
  if (assets.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No assets yet. Add your first transaction to get started.</p>
      </div>
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
                  <Button variant="ghost" size="icon">
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
