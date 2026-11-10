import type {
  boardColumns,
  boardTasks,
  roadPaths,
  roadPathCheckIns,
} from "@/db/schema";
import type { HabitStats } from "@/lib/productivity/habit";

export type BoardColumn = typeof boardColumns.$inferSelect;
export type BoardTask = typeof boardTasks.$inferSelect;
export type RoadPath = typeof roadPaths.$inferSelect;
export type RoadPathCheckIn = typeof roadPathCheckIns.$inferSelect;

export type TaskPriority = NonNullable<BoardTask["priority"]>;

export type BoardTaskWithColumn = BoardTask & {
  column: BoardColumn;
};

/** An unfinished task from an earlier day, offered to today's board. */
export type CarryOverTask = {
  id: string;
  title: string;
  columnId: string;
  columnName: string;
  boardDate: string;
};

export type RoadPathWithCheckIns = RoadPath & {
  checkIns: RoadPathCheckIn[];
};

export type RoadPathDetail = {
  roadPath: RoadPathWithCheckIns;
  stats: HabitStats;
};
