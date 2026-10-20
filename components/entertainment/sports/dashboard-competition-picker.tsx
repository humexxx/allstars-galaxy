"use client";

import { useOptimistic, useTransition, type ReactElement } from "react";

import { setSportCompetitionAction } from "@/app/actions/sports";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { runAction } from "@/lib/actions/run";
import { cn } from "@/lib/utils";
import type { DashboardCompetitions, SportId } from "@/types/sports";

/** Radix reserves the empty string, so the card's own pick needs a value of its own. */
const AUTOMATIC = "automatic";

/**
 * The line under a sport card's title, as the menu of championships the card
 * can show. It reads like the plain line it replaces — what the card shows,
 * with the stage for LoL — and the menu ticks how that was chosen.
 *
 * The choice shows at once; the card under it follows when the dashboard
 * comes back for it, and a refused change falls back to the line as it was.
 */
export function DashboardCompetitionPicker({
  sportId,
  label,
  competitions,
}: {
  sportId: SportId;
  /** What the card shows now (its `context`). */
  label: string;
  competitions: DashboardCompetitions;
}): ReactElement {
  const { waiting } = competitions;
  const [pending, startTransition] = useTransition();
  // What is stored, not what the card honoured: a waiting choice is ticked so
  // that the card's own pick is a change (Radix reports none for the ticked
  // item), and choosing it clears the old choice instead of keeping it.
  const [value, setValue] = useOptimistic(waiting?.id ?? competitions.value);

  const choose = (next: string): void => {
    const competition = next === AUTOMATIC ? null : next;
    if (competition === value) return;
    startTransition(async () => {
      setValue(competition);
      await runAction(setSportCompetitionAction({ sportId, competition }), {
        failure: "Failed to change the championship",
      });
    });
  };

  // The card's own line names its stage too, but only once it is back; until
  // then the choice is all there is to say.
  const shown = pending
    ? (competitions.options.find((o) => o.id === value)?.label ?? competitions.automatic ?? label)
    : label;

  return (
    <Select value={value ?? AUTOMATIC} onValueChange={choose}>
      <SelectTrigger
        size="sm"
        aria-label="Championship"
        aria-busy={pending}
        className="max-w-full gap-1 border-transparent bg-transparent p-0 text-muted-foreground hover:text-foreground data-[size=sm]:h-auto data-[state=open]:text-foreground dark:bg-transparent dark:hover:bg-transparent [&_svg]:size-3.5"
      >
        <SelectValue className="min-w-0">
          <span className={cn("truncate", pending && "motion-safe:animate-pulse")}>{shown}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        {competitions.automatic && (
          <SelectItem value={AUTOMATIC}>{competitions.automatic}</SelectItem>
        )}
        {competitions.options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
        {waiting && value === waiting.id && (
          <SelectItem value={waiting.id} disabled>
            {waiting.label} · when it&apos;s on
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
