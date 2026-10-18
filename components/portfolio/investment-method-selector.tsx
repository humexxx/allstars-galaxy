"use client";

import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
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
        <div className="flex flex-col gap-4">
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
          <ScrollArea className="max-h-[60svh]">
            <div className="flex flex-col gap-2">
              {filteredMethods.map((method) => (
                <Button
                  key={method.id}
                  variant="ghost"
                  className="flex h-auto items-center justify-between p-4"
                  onClick={() => {
                    onSelect(method);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-sm font-semibold text-primary">
                        {method.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium">{method.name}</span>
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
