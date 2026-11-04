// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const carryOverTasksAction = vi.fn(async (data: unknown) => {
  void data;
  return { success: true as const, data: { moved: 1, left: 1 } };
});
vi.mock("@/app/actions/board", () => ({
  carryOverTasksAction: (data: unknown) => carryOverTasksAction(data),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CarryOverDialog } from "./carry-over-dialog";

const TASKS = [
  { id: "t-work", title: "Trabajar", columnId: "c", columnName: "Working", boardDate: "2026-01-24" },
  { id: "t-gym", title: "Ejercicios", columnId: "c", columnName: "Working", boardDate: "2026-01-24" },
];

describe("CarryOverDialog", () => {
  it("leaves a task unticked when today's board already has one by that name", async () => {
    render(<CarryOverDialog tasks={TASKS} todayTitles={[" ejercicios "]} />);

    expect(screen.getByRole("checkbox", { name: /Trabajar/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Ejercicios/ })).not.toBeChecked();
    expect(screen.getByText(/already on today’s board/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Move 1 to today" }));

    expect(carryOverTasksAction).toHaveBeenCalledWith({ moveIds: ["t-work"], leaveIds: ["t-gym"] });
  });

  it("offers everything ticked when nothing is on today's board yet", () => {
    render(<CarryOverDialog tasks={TASKS} />);

    expect(screen.getByRole("button", { name: "Move all to today" })).toBeEnabled();
  });
});
