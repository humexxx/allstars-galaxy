"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, SlidersHorizontal } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Mono, Text } from "@/components/ui/typography";
import { updateMethodAction } from "@/app/actions/allocations";
import type { InvestmentMethod } from "@/types/portfolio";

export type MethodAllocationView = {
  assetId: string;
  symbol: string;
  percent: number;
};

/**
 * Editing a method you own.
 *
 * The dialog draws a hard line between the two halves of a method. What the
 * client is sold — name, risk, and above all the fixed monthly return — sits
 * up top. Where their pooled money actually goes is INTERNAL: it drives the
 * margin, the client never sees it, and mixing the two in one undifferentiated
 * form is how a private figure ends up on a screen it should not be on.
 */
export function MethodEditorDialog({
  method,
  allocations,
  onEditAllocation,
  onClose,
}: {
  method: InvestmentMethod;
  allocations: MethodAllocationView[];
  onEditAllocation: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(method.name);
  const [description, setDescription] = useState(method.description ?? "");
  const [author, setAuthor] = useState(method.author);
  const [riskLevel, setRiskLevel] = useState<string>(method.riskLevel);
  const [monthlyRoi, setMonthlyRoi] = useState(String(method.monthlyRoi));
  const [enabled, setEnabled] = useState(method.enabled);

  const submit = () => {
    startTransition(async () => {
      const result = await updateMethodAction({
        methodId: method.id,
        name,
        description: description || null,
        author,
        riskLevel: riskLevel as "Low" | "Medium" | "High",
        monthlyRoi: Number(monthlyRoi),
        enabled,
      });
      if (result?.success) {
        toast.success("Method saved");
        router.refresh();
        onClose();
      } else {
        toast.error(result?.error ?? "Could not save the method");
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit method</DialogTitle>
          <DialogDescription>
            What clients see, and what only you see.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="method-name">Name</Label>
            <Input
              id="method-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method-description">Description</Label>
            <Textarea
              id="method-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="How you describe this to a client"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="method-author">Author</Label>
              <Input
                id="method-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method-risk">Risk</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger id="method-risk">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="method-roi">Fixed monthly return (%)</Label>
            <Input
              id="method-roi"
              type="number"
              step="0.0001"
              inputMode="decimal"
              value={monthlyRoi}
              onChange={(e) => setMonthlyRoi(e.target.value)}
            />
            <Text className="text-2xs text-muted-foreground">
              The only figure a client sees, and what their balance compounds at.
              Changing it changes what you owe — it is not cosmetic.
            </Text>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="method-enabled">Open to new money</Label>
              <Text className="text-2xs text-muted-foreground">
                Disabled methods keep existing positions but leave the transaction
                form.
              </Text>
            </div>
            <Switch id="method-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Internal half. Deliberately fenced off and labelled. */}
          <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <EyeOff className="size-4 text-muted-foreground" />
              <Text className="text-xs font-medium">Internal — clients never see this</Text>
            </div>
            <Text className="text-2xs text-muted-foreground">
              Where the pooled money goes. It drives your margin; the client only ever
              sees the fixed return above.
            </Text>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Mono className="text-xs">
                {allocations.length === 0
                  ? "Not configured"
                  : allocations.map((a) => `${a.percent}% ${a.symbol}`).join(" · ")}
              </Mono>
              <Button size="sm" variant="outline" onClick={onEditAllocation}>
                <SlidersHorizontal className="size-4" />
                {allocations.length === 0 ? "Set allocation" : "Change"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending || !name.trim()}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
