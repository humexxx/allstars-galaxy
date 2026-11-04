// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShowMoreRows, useShownRows } from "./show-more";

function List({ rows, resetKey }: { rows: number[]; resetKey?: string }): React.ReactElement {
  const shown = useShownRows(rows, resetKey);
  return (
    <>
      <output aria-label="Rows shown">{shown.shown.length}</output>
      <ShowMoreRows rows={shown} />
    </>
  );
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const count = (): string | null => screen.getByRole("status", { name: "Rows shown" }).textContent;
/** The button's own status line: a live region, and so nameless. */
const said = (): string | null => screen.getByRole("status", { name: "" }).textContent;

// jsdom has no scrollIntoView.
const { scrollIntoView } = Element.prototype;
afterEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.restoreAllMocks();
});

describe("ShowMoreRows", () => {
  it("has nothing to offer for ten rows or fewer", () => {
    render(<List rows={range(10)} />);
    expect(count()).toBe("10");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("brings in ten more a tap, as many as are left, then folds back to ten", () => {
    render(<List rows={range(23)} />);
    expect(count()).toBe("10");
    fireEvent.click(screen.getByRole("button", { name: "Show 10 more" }));
    expect(count()).toBe("20");
    fireEvent.click(screen.getByRole("button", { name: "Show 3 more" }));
    expect(count()).toBe("23");
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(count()).toBe("10");
  });

  it("goes back to ten when its key changes", () => {
    const { rerender } = render(<List rows={range(23)} resetKey="east" />);
    fireEvent.click(screen.getByRole("button", { name: "Show 10 more" }));
    expect(count()).toBe("20");
    rerender(<List rows={range(23)} resetKey="west" />);
    expect(count()).toBe("10");
  });

  it("tells a screen reader what each tap brought in, and nothing before one", () => {
    render(<List rows={range(23)} />);
    expect(said()).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Show 10 more" }));
    expect(said()).toBe("Showing 20 of 23");
    fireEvent.click(screen.getByRole("button", { name: "Show 3 more" }));
    expect(said()).toBe("Showing all 23");
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(said()).toBe("Showing 10 of 23");
  });

  it("goes quiet again when its key changes", () => {
    const { rerender } = render(<List rows={range(23)} resetKey="east" />);
    fireEvent.click(screen.getByRole("button", { name: "Show 10 more" }));
    expect(said()).toBe("Showing 20 of 23");
    rerender(<List rows={range(23)} resetKey="west" />);
    expect(said()).toBe("");
  });

  it("keeps the button in sight for the keyboard as the new rows push it down", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    render(<List rows={range(23)} />);
    const button = screen.getByRole("button", { name: "Show 10 more" });
    button.focus();
    // jsdom takes any click for the mouse's, so Enter on the focused button is stood in for.
    const matches = button.matches.bind(button);
    vi.spyOn(button, "matches").mockImplementation((selector) => selector === ":focus-visible" || matches(selector));

    fireEvent.click(button);

    expect(scrolled).toHaveBeenCalledOnce();
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
    expect(scrolled.mock.contexts[0]).toBe(button);
  });

  it("leaves the page where it is after a click, even one that focused the button", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    render(<List rows={range(23)} />);

    fireEvent.click(screen.getByRole("button", { name: "Show 10 more" }));
    const button = screen.getByRole("button", { name: "Show 3 more" });
    button.focus();
    fireEvent.click(button);

    expect(count()).toBe("23");
    expect(scrolled).not.toHaveBeenCalled();
  });
});
