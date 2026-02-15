import { BoardView } from "@/components/productivity/board/board-view";
import { getUserBoardColumnsAction } from "@/app/actions/board";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Task Board | Capital Galaxy",
  description: "Manage your tasks with a visual board",
};

export default async function BoardPage() {
  const columnsResult = await getUserBoardColumnsAction();
  const columns = columnsResult.success ? columnsResult.data : [];

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Task Board</h1>
        <p className="text-muted-foreground">Manage your tasks with a visual board</p>
      </header>
      <BoardView initialColumns={columns} />
    </section>
  );
}
