"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { toggleVariants } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: "default",
  variant: "default",
})

/**
 * A segmented control — the iOS `UISegmentedControl`. The default variant is
 * a grey track with the selected segment lifted onto a white chip, the same
 * look as `TabsList`, so a view switcher reads identically whether or not it
 * owns tab panels. Use `Tabs` when each option reveals its own panel; use
 * this when the options change *how* one thing is shown (range, view, unit).
 */
function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "group/toggle-group inline-flex w-fit items-center",
        variant === "outline"
          ? "flex-wrap gap-1.5"
          : cn(
              // Same track as TabsList: grey rail, selected segment lifted.
              "rounded-lg bg-muted p-[3px]",
              size === "sm" ? "h-8" : size === "lg" ? "h-11" : "h-10"
            ),
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "shrink-0 focus:z-10 focus-visible:z-10",
        // Segments share the track evenly but never below their own label
        // (`min-w-0` clipped "Calendar" beside "List"); chips keep their
        // natural width so a row of them wraps instead of overlapping.
        (context.variant ?? variant ?? "default") === "default"
          ? "h-full min-w-fit flex-1"
          : "flex-none",
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

export { ToggleGroup, ToggleGroupItem }
