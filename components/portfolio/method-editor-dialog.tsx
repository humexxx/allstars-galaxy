"use client";

import { useState, useTransition } from "react";
import { EyeOff, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Mono, Text } from "@/components/ui/typography";
import { updateMethodAction } from "@/app/actions/allocations";
import { runAction } from "@/lib/actions/run";
import type { MethodAllocationSummary } from "@/types/margin";
import type { InvestmentMethod } from "@/types/portfolio";

type RiskLevel = InvestmentMethod["riskLevel"];

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
  allocations: MethodAllocationSummary["allocations"];
  onEditAllocation: () => void;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(method.name);
  const [description, setDescription] = useState(method.description ?? "");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(method.riskLevel);
  const [monthlyRoi, setMonthlyRoi] = useState(String(method.monthlyRoi));
  const [enabled, setEnabled] = useState(method.enabled);

  const submit = (): void => {
    startTransition(async () => {
      const result = await runAction(
        updateMethodAction({
          methodId: method.id,
          name,
          description: description || null,
          riskLevel,
          monthlyRoi: Number(monthlyRoi),
          enabled,
        }),
        { success: "Method saved", failure: "Failed to save method" }
      );
      if (result.ok) onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit method</DialogTitle>
          <DialogDescription>
            What clients see, and what only you see.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="method-name">Name</FieldLabel>
            <Input
              id="method-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="method-description">Description</FieldLabel>
            <Textarea
              id="method-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="How you describe this to a client"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="method-risk">Risk</FieldLabel>
            <Select value={riskLevel} onValueChange={(v) => setRiskLevel(v as RiskLevel)}>
              <SelectTrigger id="method-risk">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              Credited to you — a method is attributed to whoever runs it, so
              there is nothing to set here.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="method-roi">Fixed monthly return (%)</FieldLabel>
            <Input
              id="method-roi"
              type="number"
              step="0.0001"
              inputMode="decimal"
              value={monthlyRoi}
              onChange={(e) => setMonthlyRoi(e.target.value)}
            />
            <FieldDescription>
              The only figure a client sees, and what their balance compounds at.
              Changing it changes what you owe — it is not cosmetic.
            </FieldDescription>
          </Field>

          <Field orientation="horizontal" className="rounded-lg border p-3">
            <FieldContent>
              <FieldLabel htmlFor="method-enabled">Open to new money</FieldLabel>
              <FieldDescription>
                Disabled methods keep existing positions but leave the transaction
                form.
              </FieldDescription>
            </FieldContent>
            <Switch id="method-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </Field>

          {/* Internal half. Deliberately fenced off and labelled. */}
          <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <EyeOff aria-hidden className="size-4 text-muted-foreground" />
              <Text variant="small" weight="medium" className="text-foreground">
                Internal — clients never see this
              </Text>
            </div>
            <Text variant="small">
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
                <SlidersHorizontal />
                {allocations.length === 0 ? "Set allocation" : "Change"}
              </Button>
            </div>
          </div>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending || !name.trim()}>
            {isPending && <Spinner />}
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
