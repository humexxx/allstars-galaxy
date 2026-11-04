// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Toggle } from "./toggle";

describe("Toggle", () => {
  it("keeps its focus ring and stops a disabled toggle taking the pointer", () => {
    render(<Toggle disabled>Grid</Toggle>);
    const toggle = screen.getByRole("button", { name: "Grid" });
    // Two classes once glued together into one that matched nothing.
    expect(toggle).toHaveClass("focus-visible:ring-ring/50", "disabled:pointer-events-none");
  });
});
