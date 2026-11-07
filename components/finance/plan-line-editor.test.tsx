// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlanLineEditor, type EditorLine } from "./plan-line-editor";

function line(overrides: Partial<EditorLine> & Pick<EditorLine, "id" | "name">): EditorLine {
  return {
    monthlyAmount: "100",
    kind: "recurring",
    dayOfMonth: 1,
    date: null,
    startDate: null,
    endDate: null,
    ...overrides,
  };
}

const lines: EditorLine[] = [
  line({ id: "e1", name: "Experian", monthlyAmount: "6500", endDate: "2027-05-01" }),
  line({ id: "e2", name: "Experian", monthlyAmount: "3500", startDate: "2027-05-02", endDate: "2029-01-01" }),
  line({ id: "s", name: "Side gig", monthlyAmount: "250" }),
  line({ id: "p1", name: "Padre", kind: "one_time", date: "2026-12-01", monthlyAmount: "300", owedToMe: true }),
  line({ id: "p2", name: "Padre", kind: "one_time", date: "2027-01-01", monthlyAmount: "200", owedToMe: true }),
];

function renderEditor(): void {
  render(
    <PlanLineEditor
      variant="income"
      title="Income"
      emptyLabel="None"
      lines={lines}
      today={new Date(Date.UTC(2026, 10, 5))}
      onAdd={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  );
}

describe("PlanLineEditor", () => {
  it("folds phases into one row that expands to the editable lines", () => {
    renderEditor();

    const toggle = screen.getByRole("button", { name: /Experian/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Edit Experian/ })).toBeNull();
    expect(screen.getByText("$6,500.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Side gig" })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("button", { name: /^Edit Experian \(/ })).toHaveLength(2);
  });

  it("keeps money owed to you in a collapsed section with what is still owed", () => {
    renderEditor();

    const section = screen.getByRole("button", { name: /Owed to you/ });
    expect(section).toHaveAttribute("aria-expanded", "false");
    expect(section).toHaveTextContent("2 entries");
    expect(section).toHaveTextContent("$500.00");
    expect(screen.queryByRole("button", { name: /Padre/ })).toBeNull();

    fireEvent.click(section);
    fireEvent.click(screen.getByRole("button", { name: /Padre/ }));
    expect(screen.getAllByRole("button", { name: /^Delete Padre \(/ })).toHaveLength(2);
  });
});
