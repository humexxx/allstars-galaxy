// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateField } from "./date-field";

describe("DateField", () => {
  it("puts the clear button inside the control, not beside it", () => {
    // As a sibling of a `w-full` trigger it was 100% of the row plus a button,
    // which overflowed every dialog it appeared in by exactly that width.
    render(<DateField value="2027-03-24" onChange={vi.fn()} clearable />);

    const clear = screen.getByRole("button", { name: "Clear the date" });
    expect(clear.closest('[data-slot="input-group"]')).not.toBeNull();
  });

  it("never lets the trigger claim the whole row", () => {
    render(<DateField value="2027-03-24" onChange={vi.fn()} clearable />);

    const trigger = screen.getByRole("button", { name: /24 Mar 2027/ });
    expect(trigger.className).toContain("flex-1");
    expect(trigger.className).not.toContain("w-full");
  });

  it("renders on its own when there is nothing to clear", () => {
    render(<DateField value="" onChange={vi.fn()} clearable placeholder="Not set" />);

    expect(screen.queryByRole("button", { name: "Clear the date" })).toBeNull();
    expect(screen.getByRole("button", { name: "Not set" })).toBeInTheDocument();
  });
});
