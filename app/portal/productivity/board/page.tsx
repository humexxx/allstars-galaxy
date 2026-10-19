import { BoardView } from "@/components/productivity/board/board-view";
import type { Metadata } from "next";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import { dayKey } from "@/components/productivity/board/due-date";
import {
  getUserBoardColumns,
  getUserBoardTasks,
  initializeDefaultColumns,
} from "@/lib/services/board-service";

export const metadata: Metadata = {
  title: "Task Board",
  description: "Manage your tasks with a visual board",
};

export default async function BoardPage(): Promise<React.ReactElement> {
  const ctx = await requireEffectiveContext();
  const userId = ctx.effectiveUserId;

  const [existingColumns, tasks, timeZone] = await Promise.all([
    getUserBoardColumns(userId),
    getUserBoardTasks(userId),
    getRequestTimeZone(),
  ]);
  const columns =
    existingColumns.length > 0 ? existingColumns : await initializeDefaultColumns(userId);

  return (
    <BoardView
      initialColumns={columns}
      initialTasks={tasks}
      timeZone={timeZone}
      today={dayKey(new Date(), timeZone)}
    />
  );
}
