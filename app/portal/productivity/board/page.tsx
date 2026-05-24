import { BoardView } from "@/components/productivity/board/board-view";
import type { Metadata } from "next";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import {
  getUserBoardColumns,
  getUserBoardTasks,
  initializeDefaultColumns,
} from "@/lib/services/board-service";

export const metadata: Metadata = {
  title: "Task Board | Allstars Galaxy",
  description: "Manage your tasks with a visual board",
};

export default async function BoardPage(): Promise<React.ReactElement> {
  const ctx = await requireEffectiveContext();
  const userId = ctx.effectiveUserId;

  const [existingColumns, tasks] = await Promise.all([
    getUserBoardColumns(userId),
    getUserBoardTasks(userId),
  ]);
  const columns =
    existingColumns.length > 0 ? existingColumns : await initializeDefaultColumns(userId);

  return <BoardView initialColumns={columns} initialTasks={tasks} />;
}
