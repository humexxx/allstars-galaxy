// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

describe("ToggleGroup", () => {
  it("exposes the selected segment to assistive tech", () => {
    render(
      <ToggleGroup type="single" value="month" aria-label="Range">
        <ToggleGroupItem value="week">Week</ToggleGroupItem>
        <ToggleGroupItem value="month">Month</ToggleGroupItem>
      </ToggleGroup>
    );

    // Single-select Radix groups render radios; the hand-rolled segmented
    // controls this replaces conveyed selection by colour alone.
    expect(screen.getByRole("radio", { name: "Month" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Week" })).toHaveAttribute("aria-checked", "false");
  });

  it("reports the new value on change", () => {
    const onValueChange = vi.fn();
    render(
      <ToggleGroup type="single" value="week" onValueChange={onValueChange} aria-label="Range">
        <ToggleGroupItem value="week">Week</ToggleGroupItem>
        <ToggleGroupItem value="month">Month</ToggleGroupItem>
      </ToggleGroup>
    );

    fireEvent.click(screen.getByRole("radio", { name: "Month" }));
    expect(onValueChange).toHaveBeenCalledWith("month");
  });
});
