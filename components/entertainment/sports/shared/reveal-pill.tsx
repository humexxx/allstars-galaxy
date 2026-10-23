"use client";

import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * "🕘 Earlier" at the end of a list's heading line: a tap brings in a few more
 * of what the list has. Its name and tooltip say what by `detail` ("Show
 * Oct 10 – Oct 14"). A 24px pill in a 22px line: the negative margins keep
 * the line, and anything set level with it, as they are. It speaks in the
 * heading's quieter voice rather than its capitals.
 */
export function RevealPill({
  icon: Icon,
  label,
  detail,
  ...props
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
} & Omit<ComponentProps<typeof Button>, "children">): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          className="-my-1.5 rounded-full font-medium tracking-normal normal-case"
          aria-label={`${label}: ${detail}`}
          {...props}
        >
          <Icon data-icon="inline-start" />
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  );
}
