// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OverviewSplit } from "./overview-split";

const VIEW = 800;
const STUCK_AT = 72;

/**
 * jsdom has no layout: stage a sticky section `height` tall in a viewport
 * `VIEW` high, nothing between them scrolling.
 */
function stage(height: number): void {
  const real = window.getComputedStyle;
  vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
    const style = real(el, pseudo);
    if (el instanceof HTMLElement && el.tagName === "SECTION") {
      return { ...style, position: "sticky", top: `${STUCK_AT}px` } as CSSStyleDeclaration;
    }
    return style;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(height);
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(VIEW);
}

const tableSection = (): HTMLElement => screen.getByText("Standings").closest("section")!;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OverviewSplit", () => {
  it("sticks the table by its top under the sport bar while it fits", () => {
    stage(VIEW - STUCK_AT - 40);
    render(<OverviewSplit matches={<div>Games</div>} table={<div>Rows</div>} tableLabel="Standings" />);
    expect(tableSection()).toHaveClass("@4xl:sticky", "@4xl:top-18");
    expect(tableSection()).not.toHaveClass("@4xl:bottom-6");
  });

  it("sticks a table taller than the room by its foot, so its last rows stay reachable", () => {
    stage(VIEW);
    render(<OverviewSplit matches={<div>Games</div>} table={<div>Rows</div>} tableLabel="Standings" />);
    expect(tableSection()).toHaveClass("@4xl:sticky", "@4xl:bottom-6", "@4xl:self-end");
    expect(tableSection()).not.toHaveClass("@4xl:top-18");
  });

  it("gives the matches the whole row without a table", () => {
    const { container } = render(<OverviewSplit matches={<div>Games</div>} table={false} />);
    expect(container.querySelector("section")).toBeNull();
    expect(container.firstElementChild).not.toHaveClass("@4xl:grid-cols-[2fr_1fr]");
  });
});
