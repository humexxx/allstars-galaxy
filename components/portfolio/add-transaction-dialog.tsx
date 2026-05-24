"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvestmentMethodSelector } from "./investment-method-selector";
import { TransactionForm } from "./transaction-form";
import type { InvestmentMethod } from "@/types/portfolio";

type User = {
  id: string;
  fullName: string | null;
  email: string | null;
};

type AddTransactionDialogProps = {
  open: boolean;
  onClose: () => void;
  methods: InvestmentMethod[];
  /**
   * Submit handler. Must return `true` on success and `false` on failure so
   * the dialog can stay open (with the form still mounted) when the server
   * action fails — the parent is expected to surface the error via toast.
   */
  onSubmit: (data: {
    investmentMethodId: string;
    amount: string;
    date: Date;
    notes?: string;
    userId?: string;
  }) => Promise<boolean>;
  isAdmin: boolean;
  users?: User[];
  adminUserId?: string;
};

export function AddTransactionDialog({
  open,
  onClose,
  methods,
  onSubmit,
  isAdmin,
  users = [],
  adminUserId,
}: AddTransactionDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<InvestmentMethod | null>(null);
  const [showSelector, setShowSelector] = useState(true);
  const [isPending, startTransition] = useTransition();

  const handleMethodSelect = (method: InvestmentMethod) => {
    setSelectedMethod(method);
    setShowSelector(false);
  };

  const handleChangeMethod = () => {
    setShowSelector(true);
  };

  const handleSubmit = (data: { amount: string; date: Date; notes?: string; userId?: string }) => {
    if (!selectedMethod) return;

    // Wait for the action to complete before closing — otherwise the dialog
    // dismisses before any error toast appears and the user has nothing to
    // react to.
    startTransition(async () => {
      const succeeded = await onSubmit({
        investmentMethodId: selectedMethod.id,
        ...data,
      });
      if (!succeeded) return;
      setSelectedMethod(null);
      setShowSelector(true);
      onClose();
    });
  };

  const handleClose = () => {
    if (isPending) return; // Don't let the user dismiss mid-submit.
    setSelectedMethod(null);
    setShowSelector(true);
    onClose();
  };

  return (
    <>
      <InvestmentMethodSelector
        open={open && showSelector}
        onClose={handleClose}
        onSelect={handleMethodSelect}
        methods={methods}
      />
      <Dialog open={open && !showSelector && selectedMethod !== null} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          {selectedMethod && (
            <TransactionForm
              key={open ? 'open' : 'closed'}
              selectedMethod={selectedMethod}
              onChangeMethod={handleChangeMethod}
              onSubmit={handleSubmit}
              onCancel={handleClose}
              isAdmin={isAdmin}
              users={users}
              adminUserId={adminUserId}
              isSubmitting={isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
