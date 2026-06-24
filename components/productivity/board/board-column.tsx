"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { BoardTaskCard } from "./board-task-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/typography";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { BoardColumn as BoardColumnType, BoardTask } from "@/types";
import type { CreateBoardTaskData } from "@/schemas/board";
import { CreateTaskDialog } from "./create-task-dialog";
import { cn } from "@/lib/utils";

type BoardColumnProps = {
  column: BoardColumnType;
  tasks: BoardTask[];
  onCreateTask: (data: CreateBoardTaskData) => Promise<void>;
  onDeleteColumn: (columnId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  isDimmed?: boolean;
};

export function BoardColumn({
  column,
  tasks,
  onCreateTask,
  onDeleteColumn,
  onDeleteTask,
  isDimmed = false,
}: BoardColumnProps): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const handleDelete = async (): Promise<void> => {
    if (tasks.length > 0) {
      toast.error("Cannot delete column with tasks");
      return;
    }
    await onDeleteColumn(column.id);
  };

  return (
    <div
      className={cn(
        "flex h-full min-w-72 flex-1 flex-col rounded-xl border bg-muted/30 transition-colors",
        isDimmed && !isOver && "opacity-60",
        isOver && "border-primary/60 bg-primary/5 ring-2 ring-primary/30"
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Heading level="h6" as="h3">{column.name}</Heading>
          <Badge variant="secondary" className="h-5 rounded-full px-2 text-2xs font-medium">
            {tasks.length}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <CreateTaskDialog
            columns={[column]}
            defaultColumnId={column.id}
            onCreate={onCreateTask}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" />
              <span className="sr-only">Add task</span>
            </Button>
          </CreateTaskDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Column options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                Delete Column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2",
          tasks.length === 0 && "min-h-32"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <BoardTaskCard key={task.id} task={task} onDelete={onDeleteTask} />
          ))}
        </SortableContext>
        {tasks.length === 0 ? (
          <div
            className={cn(
              "m-1 flex flex-1 items-center justify-center rounded-lg border border-dashed text-xs transition-colors",
              isOver
                ? "border-primary/60 bg-primary/5 text-primary"
                : "border-border text-muted-foreground"
            )}
          >
            {isOver ? "Drop here" : "No tasks yet"}
          </div>
        ) : null}
      </div>
    </div>
  );
}

