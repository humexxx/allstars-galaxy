"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

const ShowContext = React.createContext<(() => void) | null>(null)

function Tooltip({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [openState, setOpenState] = React.useState(defaultOpen)
  const open = openProp ?? openState
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOpenState(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange]
  )
  const show = React.useCallback(() => setOpen(true), [setOpen])
  return (
    <TooltipProvider>
      <ShowContext.Provider value={show}>
        <TooltipPrimitive.Root data-slot="tooltip" open={open} onOpenChange={setOpen} {...props} />
      </ShowContext.Provider>
    </TooltipProvider>
  )
}

/**
 * A touch screen never hovers, so a tooltip on something that is not a
 * control — a column heading's definition, the reason a disabled button is
 * disabled — could not be read at all. There a tap opens it, and a tap
 * anywhere else closes it. A button's tooltip only names what the tap is about
 * to do, so a tap on one just acts.
 */
function TooltipTrigger({
  onClick,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const show = React.useContext(ShowContext)
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onClick={(event) => {
        onClick?.(event)
        const el = event.currentTarget
        if (
          !show ||
          event.defaultPrevented ||
          el.matches("button, a[href], [role=button], [role=link]") ||
          !window.matchMedia("(pointer: coarse)").matches
        )
          return
        // Radix closes a tooltip on a click of its trigger unless told not to.
        event.preventDefault()
        show()
      }}
      {...props}
    />
  )
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      {/* A tap focuses its trigger, which opens the tooltip mid-tap, and on a
          touch screen the content (its arrow above all) landed over the top
          of the trigger's hit area: the press began on the button and ended
          on the tooltip, so the click went to neither. With a mouse it stays
          hoverable, as WCAG 1.4.13 asks. */}
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "pointer-coarse:pointer-events-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 rounded-md px-3 py-1.5 text-xs bg-foreground text-background z-50 w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin)",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground z-50 translate-y-[calc(-50%_-_2px)]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
