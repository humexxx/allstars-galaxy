import { BoardView } from "@/components/productivity/board/board-view";
import type { Metadata } from "next";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getRequestTodayIso, readRequestTimeZone } from "@/lib/utils/request-today";
import { isCalendarDay } from "@/lib/productivity/habit";
import {
  getBoardColumns,
  getBoardTasksForDay,
  getCarryOverCandidates,
  initializeDefaultColumns,
} from "@/lib/services/board-service";
import { ensureHabitTasksForDay } from "@/lib/services/task-automation-service";

export const metadata: Metadata = {
  title: "Task Board",
  description: "Manage your tasks with a visual board",
};

/**
 * One day's board, `?day=YYYY-MM-DD`, today in the reader's zone by default.
 * Opening today's puts the day's habit tasks on it first and asks about
 * what earlier days left unfinished.
 *
 * Neither happens until the zone is known. On a device's first request there
 * is no `tz` cookie yet and "today" falls back to UTC — tomorrow, on a Costa
 * Rica evening. Generating then wrote tomorrow's habit tasks and stamped the
 * paths as generated, so the corrected render skipped today's. The header
 * writes the cookie and refreshes, and that render does both.
 */
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}): Promise<React.ReactElement> {
  const ctx = await requireEffectiveContext();
  const userId = ctx.effectiveUserId;
  const { day: requested } = await searchParams;

  const [existingColumns, knownZone, today] = await Promise.all([
    getBoardColumns(userId),
    readRequestTimeZone(),
    getRequestTodayIso(),
  ]);
  const timeZone = knownZone ?? "UTC";
  const columns =
    existingColumns.length > 0 ? existingColumns : await initializeDefaultColumns(userId);
  const day = isCalendarDay(requested) ? requested : today;
  const settlesToday = day === today && knownZone !== null;

  if (settlesToday) await ensureHabitTasksForDay(userId, today, timeZone);
  const [tasks, carryOver] = await Promise.all([
    getBoardTasksForDay(userId, day),
    settlesToday ? getCarryOverCandidates(userId, today) : Promise.resolve([]),
  ]);

  return (
    <BoardView
      // A new day is a new board: no optimistic state carries across.
      key={day}
      initialColumns={columns}
      initialTasks={tasks}
      carryOver={carryOver}
      day={day}
      timeZone={timeZone}
      today={today}
    />
  );
}
