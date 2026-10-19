"use client";

import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/typography";
import { formatRoi } from "./figures";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { InvestmentMethod } from "@/types/portfolio";

type InvestmentMethodSelectorProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (method: InvestmentMethod) => void;
  methods: InvestmentMethod[];
};

export function InvestmentMethodSelector({
  open,
  onClose,
  onSelect,
  methods,
}: InvestmentMethodSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMethods = methods.filter((method) =>
    method.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select investment method</DialogTitle>
          <DialogDescription>
            Pick where this money goes. You can change it on the next step.
          </DialogDescription>
        </DialogHeader>
        {/* `min-w-0` here, and `block` on Radix's viewport wrapper (it is
            `display: table`, which grows to its widest child): without both a
            long method name widened the dialog past a phone's edge. */}
        <div className="flex min-w-0 flex-col gap-4">
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search"
              aria-label="Search methods"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </InputGroup>
          <ScrollArea className="max-h-[60svh] [&_[data-slot=scroll-area-viewport]>div]:block!">
            <div className="flex flex-col gap-2">
              {filteredMethods.length === 0 && (
                <EmptyState
                  icon={Search}
                  title={
                    methods.length === 0
                      ? "No methods are open to new money"
                      : "No methods match your search"
                  }
                />
              )}
              {filteredMethods.map((method) => (
                <Button
                  key={method.id}
                  variant="ghost"
                  className="flex h-auto w-full min-w-0 items-center justify-between gap-3 p-4"
                  onClick={() => {
                    onSelect(method);
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-sm font-semibold text-primary">
                        {method.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    {/* What a client picks on: the fixed return and the risk. */}
                    <div className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                      <span className="max-w-full truncate font-medium">{method.name}</span>
                      <Text as="span" variant="small" className="font-normal">
                        {method.riskLevel} risk ·{" "}
                        {formatRoi(parseFloat(method.monthlyRoi))} a month
                      </Text>
                    </div>
                  </div>
                  <ChevronRight aria-hidden className="text-muted-foreground" />
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
