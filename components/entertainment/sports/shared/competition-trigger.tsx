"use client";

import { Trophy } from "lucide-react";

import { SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * A competition picker's trigger at the end of the tabs row (football's
 * league, LoL's region): the competition's name once the shell has room, a
 * trophy alone on a phone, where the tabs need the room and the title above
 * already names it.
 */
export function CompetitionTrigger({ label }: { label: string }): React.ReactElement {
  return (
    <SelectTrigger size="sm" aria-label={label} className="@xl:w-56">
      <Trophy aria-hidden className="@xl:hidden" />
      <span className="sr-only @xl:not-sr-only @xl:truncate">
        <SelectValue placeholder={label} />
      </span>
    </SelectTrigger>
  );
}
