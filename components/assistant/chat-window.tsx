"use client";

import type { ReactNode, RefObject } from "react";
import { RotateCcw, Sparkles, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** The corner button that opens an assistant. */
export function AssistantButton({
  label,
  hidden,
  onClick,
}: {
  label: string;
  hidden?: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <Button
      size="icon-lg"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "fixed right-4 z-40 size-12 rounded-full shadow-lg",
        // Clear of the dev-tools wrench, which only exists in development.
        process.env.NODE_ENV === "development" ? "bottom-16" : "bottom-4",
        hidden && "hidden"
      )}
    >
      <Sparkles />
    </Button>
  );
}

/**
 * Where the chat sits. A phone gives it the whole screen. Anything wider gets
 * a window floating in the corner: no dimming, and the page behind it stays
 * in view and in reach. Clicking the page leaves the window open; Escape or
 * the close button shuts it.
 */
export function ChatWindow({
  open,
  onOpenChange,
  phone,
  slot,
  focus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: boolean;
  /** The floating window's `data-slot`. */
  slot: string;
  /** What takes the focus when the window opens: the message box. */
  focus: RefObject<HTMLElement | null>;
  children: ReactNode;
}): React.ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={phone}>
      {phone ? (
        <SheetContent side="right" className="flex flex-col gap-0 data-[side=right]:w-full">
          {children}
        </SheetContent>
      ) : (
        // Not portalled: the content's own presence plays the exit animation,
        // which a wrapper inside the portal would cut short. The wrapper only
        // places the window and lets clicks through to the page around it.
        <div className="pointer-events-none fixed inset-y-4 right-4 z-50 flex flex-col justify-end">
          <DialogPrimitive.Content
            data-slot={slot}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              focus.current?.focus();
            }}
            onInteractOutside={(e) => e.preventDefault()}
            className="pointer-events-auto relative flex h-160 max-h-full w-sm origin-bottom-right flex-col overflow-hidden rounded-2xl border bg-popover text-sm shadow-2xl duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-bottom-4 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:slide-out-to-bottom-4"
          >
            {children}
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" className="absolute top-4 right-4">
                <X />
                <span className="sr-only">Close</span>
              </Button>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </div>
      )}
    </Sheet>
  );
}

/** The window's title row, with "New chat" once there is a conversation to drop. */
export function ChatHeader({
  title,
  description,
  onReset,
  busy,
}: {
  title: string;
  description: string;
  /** Absent while there is nothing to start over from. */
  onReset?: () => void;
  busy?: boolean;
}): React.ReactElement {
  return (
    <SheetHeader className="border-b pr-12">
      <div className="flex items-center justify-between gap-2">
        <SheetTitle className="flex items-center gap-2">
          <Sparkles aria-hidden className="size-4 text-primary" /> {title}
        </SheetTitle>
        {onReset && (
          <Button size="sm" variant="ghost" onClick={onReset} disabled={busy}>
            <RotateCcw />
            New chat
          </Button>
        )}
      </div>
      <SheetDescription>{description}</SheetDescription>
    </SheetHeader>
  );
}
