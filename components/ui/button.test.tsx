// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("shows a pointer, so a control looks like one", () => {
    // Tailwind v4's preflight dropped the browser's `cursor: pointer` on
    // buttons, and this component never put it back — so every button in the
    // app, 86 files of them, hovered as an arrow.
    render(<Button>Do the thing</Button>);
    expect(screen.getByRole("button").className).toContain("cursor-pointer");
  });

  it("does not claim a cursor it cannot show", () => {
    // `disabled:pointer-events-none` means a disabled button is never hit
    // tested, so the cursor comes from whatever is painted behind it. A
    // `disabled:cursor-not-allowed` alongside it looks like it does
    // something and does not.
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole("button").className).toContain("disabled:pointer-events-none");
    expect(screen.getByRole("button").className).not.toContain("cursor-not-allowed");
  });
});
