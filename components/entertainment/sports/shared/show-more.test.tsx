// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShowMoreRows, useShownRows } from "./show-more";

function List({ rows, resetKey }: { rows: number[]; resetKey?: string }): React.ReactElement {
  const shown = useShownRows(rows, resetKey);
  return (
    <>
      <output>{shown.shown.length}</output>
      <ShowMoreRows rows={shown} />
    </>
  );
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const count = (): string | null => screen.getByRole("status").textContent;

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
});
