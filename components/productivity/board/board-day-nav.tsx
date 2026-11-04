import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { addDays } from "@/lib/productivity/habit";
import { formatWeekdayDay } from "@/lib/utils/date";

type BoardDayNavProps = {
  day: string;
  today: string;
};

function relativeName(day: string, today: string): string | null {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  if (day === addDays(today, 1)) return "Tomorrow";
  return null;
}

/** Which day's board this is, and the way to the days either side. */
export function BoardDayNav({ day, today }: BoardDayNavProps): React.ReactElement {
  const name = relativeName(day, today);
  const href = (target: string): string =>
    target === today ? "?" : `?day=${target}`;

  return (
    <nav aria-label="Board day" className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" asChild>
          <Link href={href(addDays(day, -1))} aria-label="Previous day" scroll={false}>
            <ChevronLeft />
          </Link>
        </Button>
        <Button variant="outline" size="icon-sm" asChild>
          <Link href={href(addDays(day, 1))} aria-label="Next day" scroll={false}>
            <ChevronRight />
          </Link>
        </Button>
      </div>
      <Text weight="medium" as="p" aria-live="polite">
        {name ? `${name} · ` : null}
        {formatWeekdayDay(day)}
      </Text>
      {day !== today ? (
        <Button variant="ghost" size="sm" asChild>
          <Link href="?" scroll={false}>
            Back to today
          </Link>
        </Button>
      ) : null}
    </nav>
  );
}
