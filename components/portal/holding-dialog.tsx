"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import { createPriceAssetAction, upsertHoldingAction } from "@/app/actions/holdings";

export type AssetOption = {
  id: string;
  symbol: string;
  name: string;
  source: string;
};

type HoldingDialogProps = {
  open: boolean;
  methodId: string;
  methodName: string;
  assets: AssetOption[];
  initial?: {
    id: string;
    assetId: string;
    quantity: number;
    costBasis: number;
    note: string | null;
  };
  onClose: () => void;
};

const NEW_ASSET = "__new__";

/**
 * Provider id hints. Getting these wrong is the one mistake that fails
 * silently — the row saves, the cron finds nothing, and the holding sits
 * unpriced looking like a loss.
 */
const SOURCE_HINTS: Record<string, string> = {
  massive: 'Ticker: "X:ADAUSD" for crypto, "I:SPX" for an index, "AAPL" for a stock',
  coingecko: 'Coin id, not the symbol — "cardano", not "ADA"',
  manual: "No provider id — you set the price by hand",
};

export function HoldingDialog({
  open,
  methodId,
  methodName,
  assets,
  initial,
  onClose,
}: HoldingDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [assetId, setAssetId] = useState(initial?.assetId ?? "");
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "");
  const [costBasis, setCostBasis] = useState(initial ? String(initial.costBasis) : "");

  const [newSymbol, setNewSymbol] = useState("");
  const [newName, setNewName] = useState("");
  const [newSource, setNewSource] = useState("massive");
  const [newExternalId, setNewExternalId] = useState("");

  const creatingAsset = assetId === NEW_ASSET;

  const submit = () => {
    startTransition(async () => {
      let targetAssetId = assetId;

      if (creatingAsset) {
        const created = await createPriceAssetAction({
          symbol: newSymbol,
          name: newName,
          source: newSource as "massive" | "coingecko" | "manual",
          externalId: newExternalId || null,
        });
        if (!created?.success) {
          toast.error(created?.error ?? "Could not create the asset");
          return;
        }
        if (!created.data) {
          toast.error("Could not create the asset");
          return;
        }
        targetAssetId = created.data.id;
      }

      if (!targetAssetId) {
        toast.error("Pick an asset");
        return;
      }

      const result = await upsertHoldingAction({
        methodId,
        assetId: targetAssetId,
        quantity: Number(quantity),
        costBasis: Number(costBasis || 0),
        note: null,
      });

      if (result?.success) {
        toast.success("Holding saved");
        router.refresh();
        onClose();
      } else {
        toast.error(result?.error ?? "Could not save the holding");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit holding" : "Add holding"}</DialogTitle>
          <DialogDescription>
            Where {methodName}&apos;s pooled capital is actually deployed. Investors never
            see this — it only drives your margin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="holding-asset">Asset</Label>
            <Select value={assetId} onValueChange={setAssetId} disabled={!!initial}>
              <SelectTrigger id="holding-asset">
                <SelectValue placeholder="Pick an asset" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.symbol} — {a.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_ASSET}>+ New asset…</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {creatingAsset && (
            <div className="space-y-4 rounded-lg border border-dashed p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="asset-symbol">Symbol</Label>
                  <Input
                    id="asset-symbol"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    placeholder="ADA"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-name">Name</Label>
                  <Input
                    id="asset-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Cardano"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-source">Priced by</Label>
                <Select value={newSource} onValueChange={setNewSource}>
                  <SelectTrigger id="asset-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="massive">Massive — crypto, indices, stocks</SelectItem>
                    <SelectItem value="coingecko">CoinGecko — crypto only, no key</SelectItem>
                    <SelectItem value="manual">Manual — I set the price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newSource !== "manual" && (
                <div className="space-y-2">
                  <Label htmlFor="asset-external">Provider id</Label>
                  <Input
                    id="asset-external"
                    value={newExternalId}
                    onChange={(e) => setNewExternalId(e.target.value)}
                    placeholder={newSource === "massive" ? "X:ADAUSD" : "cardano"}
                  />
                  <Text className="text-2xs text-muted-foreground">
                    {SOURCE_HINTS[newSource]}
                  </Text>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="holding-quantity">Quantity</Label>
              <Input
                id="holding-quantity"
                type="number"
                step="any"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1250.5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holding-cost">Cost basis</Label>
              <Input
                id="holding-cost"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={costBasis}
                onChange={(e) => setCostBasis(e.target.value)}
                placeholder="6700.00"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending || !quantity}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
