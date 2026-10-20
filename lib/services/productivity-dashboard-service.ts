import "server-only";

import { buildDashboardProductivity, type DashboardProductivity } from "@/lib/productivity/dashboard";

import { getBoardColumns, getBoardTasksForDay, getCarryOverCandidates } from "./board-service";
import { getUserRoadPaths } from "./road-path-service";
import { ensureHabitTasksForDay } from "./task-automation-service";

/**
 * The dashboard's productivity card. The dashboard is where the app opens, so
 * it puts today's habit tasks on the board the way opening the board does —
 * they are there, and counted, before the board is ever visited. Like the
 * board, it writes nothing while the reader's zone is unknown (`timeZone`
 * null): "today" would be UTC's day.
 */
export async function getDashboardProductivity(
  userId: string,
  today: string,
  timeZone: string | null
): Promise<DashboardProductivity> {
  if (timeZone) await ensureHabitTasksForDay(userId, today, timeZone);

  const [columns, tasks, carryOver, roadPaths] = await Promise.all([
    getBoardColumns(userId),
    getBoardTasksForDay(userId, today),
    timeZone ? getCarryOverCandidates(userId, today) : Promise.resolve([]),
    getUserRoadPaths(userId),
  ]);

  return buildDashboardProductivity({
    today,
    timeZone: timeZone ?? "UTC",
    columns,
    tasks,
    carryOverCount: carryOver.length,
    roadPaths,
  });
}
