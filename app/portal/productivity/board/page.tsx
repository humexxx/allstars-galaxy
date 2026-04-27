import { BoardView } from "@/components/productivity/board/board-view";
import type { Metadata } from "next";
import { requireAuthCached } from "@/lib/services/auth-server";
import {
  getUserBoardColumns,
  getUserBoardTasks,
  initializeDefaultColumns,
} from "@/lib/services/board-service";

export const metadata: Metadata = {
  title: "Task Board | Capital Galaxy",
  description: "Manage your tasks with a visual board",
};

export default async function BoardPage(): Promise<React.ReactElement> {
  const user = await requireAuthCached();
  const [existingColumns, tasks] = await Promise.all([
    getUserBoardColumns(user.id),
    getUserBoardTasks(user.id),
  ]);
  const columns =
    existingColumns.length > 0 ? existingColumns : await initializeDefaultColumns(user.id);

  return <BoardView initialColumns={columns} initialTasks={tasks} />;
}
