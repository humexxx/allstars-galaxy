/**
 * The dashboard's productivity card: today's board in figures, and where each
 * habit stands today. Pure, so the card and its tests read the same thing.
 */

import {
  addDays,
  dayStatus,
  habitOf,
  habitStats,
  hasSchedule,
  nextDueDay,
  type Habit,
  type HabitDayStatus,
} from "./habit";

type ColumnRow = { id: string; name: string; order: number; isDone: boolean };
type TaskRow = {
  id: string;
  title: string;
  columnId: string;
  order: number;
  roadPathId: string | null;
  completedAt: Date | string | null;
};
type RoadPathRow = {
  id: string;
  title: string;
  scheduleDays: number[] | null;
  scheduleSince: string | null;
  startDate: Date | string;
  completedAt: Date | string | null;
  checkIns: { day: string }[];
};

export type DashboardOpenTask = {
  id: string;
  title: string;
  columnName: string;
  isHabit: boolean;
};

export type DashboardHabit = {
  id: string;
  title: string;
  habit: Habit;
  checkIns: string[];
  /** Today, for this habit: done, due, or not a day it is due. */
  today: HabitDayStatus;
  currentStreak: number;
  /** The next day it is due after today, when today is settled or off. */
  next: string | null;
};

export type DashboardProductivity = {
  today: string;
  total: number;
  done: number;
  /** Unfinished, in board order: column by column, top to bottom. */
  open: DashboardOpenTask[];
  /** Open tasks from earlier days waiting for the carry-over answer. */
  carryOverCount: number;
  /** Scheduled, not completed: what is due today first. */
  habits: DashboardHabit[];
};

const HABIT_ORDER: Record<HabitDayStatus, number> = {
  due: 0,
  done: 1,
  missed: 2,
  upcoming: 3,
  rest: 3,
  outside: 4,
};

export function buildDashboardProductivity(input: {
  today: string;
  timeZone: string;
  columns: ColumnRow[];
  tasks: TaskRow[];
  carryOverCount: number;
  roadPaths: RoadPathRow[];
}): DashboardProductivity {
  const { today, timeZone, columns, tasks, carryOverCount, roadPaths } = input;
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const finished = (task: TaskRow): boolean =>
    task.completedAt !== null || columnById.get(task.columnId)?.isDone === true;

  const open = tasks
    .filter((task) => !finished(task))
    .sort(
      (a, b) =>
        (columnById.get(a.columnId)?.order ?? 0) - (columnById.get(b.columnId)?.order ?? 0) ||
        a.order - b.order
    )
    .map((task) => ({
      id: task.id,
      title: task.title,
      columnName: columnById.get(task.columnId)?.name ?? "",
      isHabit: task.roadPathId !== null,
    }));

  const habits = roadPaths
    .filter((path) => path.completedAt === null)
    .map((path) => {
      const habit = habitOf(path, timeZone);
      const checkIns = path.checkIns.map((c) => c.day);
      const status = dayStatus(habit, today, new Set(checkIns), today);
      return {
        id: path.id,
        title: path.title,
        habit,
        checkIns,
        today: status,
        currentStreak: habitStats(habit, checkIns, today).currentStreak,
        next: status === "due" ? today : nextDueDay(habit, addDays(today, 1)),
      };
    })
    .filter((entry) => hasSchedule(entry.habit))
    .sort((a, b) => HABIT_ORDER[a.today] - HABIT_ORDER[b.today] || (a.next ?? "~").localeCompare(b.next ?? "~"));

  return {
    today,
    total: tasks.length,
    done: tasks.length - open.length,
    open,
    carryOverCount,
    habits,
  };
}
