import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

type StatCardTone = "positive" | "negative" | "neutral";

type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  sublabel?: ReactNode;
  tone?: StatCardTone;
  action?: ReactNode;
  /** Optional bare trend line under the figure — a sparkline, no axes and no
   *  labels. It gives the number a direction without spending a whole chart
   *  on it. Keep it decorative: anything the reader must be able to read
   *  precisely belongs in `sublabel`. */
  chart?: ReactNode;
  className?: string;
};

export function statToneClass(tone?: StatCardTone): string {
  if (tone === "positive") return "text-emerald-600 dark:text-emerald-400";
  if (tone === "negative") return "text-rose-600 dark:text-rose-400";
  return "";
}

export function StatCard({
  label,
  value,
  sublabel,
  tone,
  action,
  chart,
  className,
}: StatCardProps) {
  return (
    <Card size="sm" className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <Eyebrow as="div">{label}</Eyebrow>
        {action}
      </CardHeader>
      <CardContent className="space-y-1">
        <Mono
          className={cn(
            "block text-xl font-semibold tabular-nums sm:text-2xl",
            statToneClass(tone)
          )}
        >
          {value}
        </Mono>
        {sublabel && (
          <Text variant="small" as="div">
            {sublabel}
          </Text>
        )}
        {chart && (
          <div aria-hidden="true" className="pt-1">
            {chart}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
