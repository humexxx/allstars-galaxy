import type { ComponentType, ReactNode } from "react";

import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  className?: string;
  variant?: "card" | "inline";
};

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
  variant = "inline",
}: EmptyStateProps) {
  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex flex-1 items-center justify-center p-4 pt-8 md:pt-16 lg:pt-24",
          className
        )}
      >
        <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
          <div className="flex flex-col items-center gap-6 text-center">
            {Icon && (
              <div className="rounded-full bg-primary/10 p-6">
                <Icon className="h-12 w-12 text-primary" />
              </div>
            )}
            <div className="space-y-2">
              <Heading level="h3" as="h2">{title}</Heading>
              {description && <Text variant="muted">{description}</Text>}
            </div>
            {action && <div className="w-full">{action}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border p-8 text-center",
        className
      )}
    >
      {Icon && <Icon className="h-8 w-8 text-muted-foreground" />}
      <div className="space-y-1">
        <Text className="font-medium">{title}</Text>
        {description && <Text variant="muted">{description}</Text>}
      </div>
      {action}
    </div>
  );
}
