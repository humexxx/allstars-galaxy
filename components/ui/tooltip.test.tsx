// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

function touchScreen(): void {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === "(pointer: coarse)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
}

describe("Tooltip", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens on a tap of something that is not a control, on a touch screen", () => {
    touchScreen();
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>Debt pmt</span>
        </TooltipTrigger>
        <TooltipContent>Scheduled minimums plus any extra</TooltipContent>
      </Tooltip>
    );
    fireEvent.click(screen.getByText("Debt pmt"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Scheduled minimums plus any extra");
  });

  it("leaves a button's tap to the button", () => {
    touchScreen();
    const onClick = vi.fn();
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={onClick}>
            Delete
          </button>
        </TooltipTrigger>
        <TooltipContent>Delete the trip</TooltipContent>
      </Tooltip>
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps a click with a mouse to hover's job", () => {
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>Month</span>
        </TooltipTrigger>
        <TooltipContent>Each row is where the period closes</TooltipContent>
      </Tooltip>
    );
    fireEvent.click(screen.getByText("Month"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
