import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/impersonation", () => ({
  requireEffectiveContext: vi.fn(async () => ({ effectiveUserId: "user-1" })),
}));

const readRequestTimeZone = vi.fn<() => Promise<string | null>>();
const getRequestTodayIso = vi.fn<() => Promise<string>>();
vi.mock("@/lib/utils/request-today", () => ({
  readRequestTimeZone: () => readRequestTimeZone(),
  getRequestTodayIso: () => getRequestTodayIso(),
}));

const getBoardTasksForDay = vi.fn(async () => []);
const getCarryOverCandidates = vi.fn(async () => [{ id: "t-1" }]);
vi.mock("@/lib/services/board-service", () => ({
  getBoardColumns: vi.fn(async () => [{ id: "c-1" }]),
  initializeDefaultColumns: vi.fn(),
  getBoardTasksForDay: (...args: unknown[]) => getBoardTasksForDay(...(args as [])),
  getCarryOverCandidates: (...args: unknown[]) => getCarryOverCandidates(...(args as [])),
}));

const ensureHabitTasksForDay = vi.fn(async () => []);
vi.mock("@/lib/services/task-automation-service", () => ({
  ensureHabitTasksForDay: (...args: unknown[]) => ensureHabitTasksForDay(...(args as [])),
}));

vi.mock("@/components/productivity/board/board-view", () => ({ BoardView: () => null }));

import BoardPage from "./page";

type BoardProps = { day: string; timeZone: string; today: string; carryOver: unknown[] };

async function renderPage(day?: string): Promise<BoardProps> {
  const element = await BoardPage({ searchParams: Promise.resolve({ day }) });
  return element.props as BoardProps;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BoardPage", () => {
  it("puts today's habit tasks on the board and asks about earlier days, in the reader's zone", async () => {
    readRequestTimeZone.mockResolvedValue("America/Costa_Rica");
    getRequestTodayIso.mockResolvedValue("2026-10-19");

    const props = await renderPage();

    expect(ensureHabitTasksForDay).toHaveBeenCalledWith("user-1", "2026-10-19", "America/Costa_Rica");
    expect(getCarryOverCandidates).toHaveBeenCalledWith("user-1", "2026-10-19");
    expect(props).toEqual(
      expect.objectContaining({ day: "2026-10-19", timeZone: "America/Costa_Rica", carryOver: [{ id: "t-1" }] })
    );
  });

  it("writes nothing before the reader's zone is known", async () => {
    // First visit, Costa Rica evening: UTC already says tomorrow.
    readRequestTimeZone.mockResolvedValue(null);
    getRequestTodayIso.mockResolvedValue("2026-10-20");

    const props = await renderPage();

    expect(ensureHabitTasksForDay).not.toHaveBeenCalled();
    expect(getCarryOverCandidates).not.toHaveBeenCalled();
    expect(props).toEqual(expect.objectContaining({ timeZone: "UTC", carryOver: [] }));
  });

  it("only reads another day's board", async () => {
    readRequestTimeZone.mockResolvedValue("America/Costa_Rica");
    getRequestTodayIso.mockResolvedValue("2026-10-19");

    const props = await renderPage("2026-10-12");

    expect(props.day).toBe("2026-10-12");
    expect(getBoardTasksForDay).toHaveBeenCalledWith("user-1", "2026-10-12");
    expect(ensureHabitTasksForDay).not.toHaveBeenCalled();
    expect(getCarryOverCandidates).not.toHaveBeenCalled();
  });

  it("falls back to today for a day the calendar does not have", async () => {
    readRequestTimeZone.mockResolvedValue("America/Costa_Rica");
    getRequestTodayIso.mockResolvedValue("2026-10-19");

    expect((await renderPage("2026-02-30")).day).toBe("2026-10-19");
  });
});
