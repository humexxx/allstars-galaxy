import type {
  boardColumns,
  boardTasks,
  roadPaths,
  roadPathMilestones,
  roadPathProgress,
} from "@/db/schema";

export type BoardColumn = typeof boardColumns.$inferSelect;
export type BoardTask = typeof boardTasks.$inferSelect;
export type RoadPath = typeof roadPaths.$inferSelect;
export type RoadPathMilestone = typeof roadPathMilestones.$inferSelect;
export type RoadPathProgress = typeof roadPathProgress.$inferSelect;

export type TaskPriority = NonNullable<BoardTask["priority"]>;
export type RoadPathFrequency = NonNullable<RoadPath["taskFrequency"]>;

export type BoardTaskWithColumn = BoardTask & {
  column: BoardColumn;
};

export type BoardColumnWithTasks = BoardColumn & {
  tasks: BoardTask[];
};

export type RoadPathWithDetails = RoadPath & {
  milestones: RoadPathMilestone[];
  progress: RoadPathProgress[];
  tasks: BoardTaskWithColumn[];
};

export type RoadPathStats = {
  totalProgress: number;
  completedMilestones: number;
  totalMilestones: number;
  daysRemaining: number | null;
  progressRate: number;
};
