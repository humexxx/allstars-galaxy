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

export default async function BoardPage() {
  const user = await requireAuthCached();
  const [existingColumns, tasks] = await Promise.all([
    getUserBoardColumns(user.id),
    getUserBoardTasks(user.id),
  ]);
  const columns =
    existingColumns.length > 0 ? existingColumns : await initializeDefaultColumns(user.id);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Task Board</h1>
        <p className="text-muted-foreground">Manage your tasks with a visual board</p>
      </header>
      <BoardView initialColumns={columns} initialTasks={tasks} />
    </section>
  );
}
