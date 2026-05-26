/**
 * Typography primitives for Allstars Galaxy.
 *
 * Source of truth for the type system: docs/TYPOGRAPHY.md
 * Keep variants here in sync with the scale documented there.
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const headingVariants = cva("text-foreground text-balance", {
  variants: {
    level: {
      display: "text-5xl font-extrabold tracking-tight lg:text-6xl",
      h1: "text-4xl font-extrabold tracking-tight",
      h2: "text-3xl font-semibold tracking-tight",
      h3: "text-2xl font-semibold tracking-tight",
      h4: "text-xl font-semibold tracking-tight",
      h5: "text-lg font-semibold tracking-tight",
      h6: "text-base font-semibold tracking-tight",
    },
  },
  defaultVariants: {
    level: "h2",
  },
});

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div";

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> &
  VariantProps<typeof headingVariants> & {
    as?: HeadingTag;
    asChild?: boolean;
  };

function Heading({
  className,
  level = "h2",
  as,
  asChild = false,
  ...props
}: HeadingProps) {
  const Comp = asChild
    ? Slot.Root
    : ((as ?? defaultTagForLevel(level)) as HeadingTag);

  return (
    <Comp
      data-slot="heading"
      data-level={level}
      className={cn(headingVariants({ level, className }))}
      {...props}
    />
  );
}

function defaultTagForLevel(level: HeadingProps["level"]): HeadingTag {
  switch (level) {
    case "display":
      return "h1";
    case "h1":
      return "h1";
    case "h2":
      return "h2";
    case "h3":
      return "h3";
    case "h4":
      return "h4";
    case "h5":
      return "h5";
    case "h6":
      return "h6";
    default:
      return "h2";
  }
}

const textVariants = cva("", {
  variants: {
    variant: {
      lead: "text-xl text-muted-foreground",
      body: "text-base leading-7 text-foreground",
      "body-lg": "text-base leading-7 text-foreground",
      large: "text-lg font-semibold text-foreground",
      muted: "text-sm text-muted-foreground",
      small: "text-sm font-medium leading-none text-foreground",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

type TextProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof textVariants> & {
    as?: "p" | "span" | "div" | "label";
    asChild?: boolean;
  };

function Text({
  className,
  variant,
  weight,
  as = "p",
  asChild = false,
  ...props
}: TextProps) {
  const Comp = asChild ? Slot.Root : as;
  return (
    <Comp
      data-slot="text"
      data-variant={variant ?? "body"}
      className={cn(textVariants({ variant, weight, className }))}
      {...props}
    />
  );
}

const eyebrowVariants = cva(
  "text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground",
);

type EyebrowProps = React.HTMLAttributes<HTMLElement> & {
  as?: "p" | "span" | "div";
  asChild?: boolean;
};

function Eyebrow({
  className,
  as = "span",
  asChild = false,
  ...props
}: EyebrowProps) {
  const Comp = asChild ? Slot.Root : as;
  return (
    <Comp
      data-slot="eyebrow"
      className={cn(eyebrowVariants(), className)}
      {...props}
    />
  );
}

type CodeProps = React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean;
};

function Code({ className, asChild = false, ...props }: CodeProps) {
  const Comp = asChild ? Slot.Root : "code";
  return (
    <Comp
      data-slot="code"
      className={cn(
        "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold tabular-nums text-foreground",
        className,
      )}
      {...props}
    />
  );
}

type MonoProps = React.HTMLAttributes<HTMLElement> & {
  as?: "span" | "div" | "p";
  asChild?: boolean;
};

function Mono({ className, as = "span", asChild = false, ...props }: MonoProps) {
  const Comp = asChild ? Slot.Root : as;
  return (
    <Comp
      data-slot="mono"
      className={cn("font-mono tabular-nums", className)}
      {...props}
    />
  );
}

export {
  Heading,
  Text,
  Eyebrow,
  Code,
  Mono,
  headingVariants,
  textVariants,
};
