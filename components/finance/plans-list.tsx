"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowRight,
  Copy,
  MoreHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heading, Mono, Text } from "@/components/ui/typography";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  clonePlanAction,
  deletePlanAction,
  setMainPlanAction,
} from "@/app/actions/finance-plans";
import { formatCurrency } from "@/lib/utils/format";
import type { FinancePlan } from "@/types/finance";

// UTC-anchored — plan.startMonth is stored at UTC midnight; local formatting
// would shift a month in negative-offset timezones.
const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Projection-derived outcome for a plan card. Keyed by plan id by the page. */
export type PlanSummary = {
  monthsToDebtFree: number | null;
  endingNetWorth: number;
  endingDebt: number;
  endDate: Date | null;
};

const POSITIVE = "text-emerald-600 dark:text-emerald-400";
const NEGATIVE = "text-rose-600 dark:text-rose-400";

export function PlansList({
  plans,
  summaries,
}: {
  plans: FinancePlan[];
  summaries: Record<string, PlanSummary>;
}) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<FinancePlan | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClone = (plan: FinancePlan) => {
    startTransition(async () => {
      const result = await clonePlanAction(plan.id, `${plan.name} (copy)`);
      if (result.success) {
        toast.success("Plan cloned");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSetMain = (plan: FinancePlan) => {
    if (plan.isMain) return;
    startTransition(async () => {
      const result = await setMainPlanAction(plan.id);
      if (result.success) {
        toast.success(`${plan.name} is now your main plan`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    startTransition(async () => {
      const result = await deletePlanAction(pendingDelete.id);
      if (result.success) {
        toast.success("Plan deleted");
        setPendingDelete(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="group/card flex flex-col transition-colors hover:border-foreground/20">
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <Link
                href={`/portal/plans/${plan.id}`}
                className="min-w-0 flex-1 space-y-1"
              >
                <Heading level="h6" as="h3" className="line-clamp-1 flex items-center gap-1.5">
                  {plan.name}
                  {plan.isMain && (
                    <span
                      title="Main plan"
                      className="inline-flex"
                      aria-label="Main plan"
                    >
                      <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-500" />
                    </span>
                  )}
                </Heading>
                <Text variant="muted" className="line-clamp-2">
                  {plan.description || "No description"}
                </Text>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mr-2 h-8 w-8 shrink-0"
                    aria-label={`Actions for ${plan.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => handleSetMain(plan)}
                    disabled={plan.isMain}
                  >
                    <Star className="mr-2 h-4 w-4" />
                    {plan.isMain ? "Main plan" : "Set as main"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleClone(plan)}>
                    <Copy className="mr-2 h-4 w-4" /> Clone
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setPendingDelete(plan);
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="space-y-2 py-2">
              {(() => {
                const s = summaries[plan.id];
                if (!s) return null;
                return (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <Text variant="small">
                        Net worth
                        {s.endDate
                          ? ` · ${MONTH_FORMATTER.format(s.endDate)}`
                          : ""}
                      </Text>
                      <Mono
                        className={`text-sm font-semibold tabular-nums ${
                          s.endingNetWorth >= 0 ? POSITIVE : NEGATIVE
                        }`}
                      >
                        {formatCurrency(s.endingNetWorth)}
                      </Mono>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Text variant="small">Debt-free</Text>
                      {s.monthsToDebtFree !== null ? (
                        <Mono
                          className={`text-sm font-semibold tabular-nums ${POSITIVE}`}
                        >
                          {s.monthsToDebtFree} mo
                        </Mono>
                      ) : s.endingDebt <= 0.01 ? (
                        <Text variant="small" className="font-medium">
                          No debt
                        </Text>
                      ) : (
                        <Text variant="small" className={`font-medium ${NEGATIVE}`}>
                          Beyond horizon
                        </Text>
                      )}
                    </div>
                  </>
                );
              })()}
              <div className="flex items-center justify-between gap-3">
                <Text variant="small">From</Text>
                <Mono className="text-sm font-semibold tabular-nums">
                  {MONTH_FORMATTER.format(plan.startMonth)}
                </Mono>
              </div>
              {plan.includePortfolio && (
                <div className="flex items-center justify-between gap-3">
                  <Text variant="small">Portfolio</Text>
                  <Badge variant="secondary" className="h-5 px-1.5 text-2xs">
                    Linked
                  </Badge>
                </div>
              )}
            </CardContent>
            <CardFooter className="mt-auto justify-end pt-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/portal/plans/${plan.id}`}>
                  Open <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.name}</strong> and all its income, expense and debt
              rows will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
