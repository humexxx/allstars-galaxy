import type { ComponentType, ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  className?: string;
  /**
   * `inline` — a dashed placeholder inside a card or list: "nothing here yet".
   * `card` — a whole-page empty state (first run, not found), centred in the
   * content area on its own card.
   */
  variant?: "card" | "inline";
  /** Heading tag for the card variant. A not-found or first-run page has no
   *  other heading, so it passes `"h1"`. */
  titleAs?: "h1" | "h2" | "h3";
};

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
  variant = "inline",
  titleAs = "h2",
}: EmptyStateProps) {
  if (variant === "card") {
    return (
      <div
        data-slot="empty-state"
        className={cn(
          "flex flex-1 items-center justify-center p-4 pt-8 md:pt-16 lg:pt-24",
          className
        )}
      >
        <Card className="w-full max-w-md items-center gap-6 px-6 py-8 text-center">
          {Icon && (
            <div className="rounded-full bg-primary/10 p-5">
              <Icon aria-hidden className="size-10 text-primary" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Heading level="h3" as={titleAs}>
              {title}
            </Heading>
            {description && (
              <Text variant="muted" as="div">
                {description}
              </Text>
            )}
          </div>
          {action && <div className="flex w-full flex-col gap-2">{action}</div>}
        </Card>
      </div>
    );
  }

  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center",
        className
      )}
    >
      {Icon && <Icon aria-hidden className="size-8 text-muted-foreground" />}
      <div className="flex flex-col gap-1">
        <Text weight="medium">{title}</Text>
        {description && (
          <Text variant="muted" as="div">
            {description}
          </Text>
        )}
      </div>
      {action}
    </div>
  );
}
