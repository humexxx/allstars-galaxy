// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MoneyInput, currencySymbol } from "./money-input";

describe("currencySymbol", () => {
  it("finds the symbol for common currencies", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
  });

  it("falls back to the code rather than throwing on nonsense", () => {
    expect(currencySymbol("NOTACURRENCY")).toBe("NOTACURRENCY");
  });
});

describe("MoneyInput", () => {
  it("shows the currency symbol beside the amount", () => {
    render(<MoneyInput id="p" value="1900" onChange={vi.fn()} currency="USD" />);
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("keeps digits and drops anything that is not a number", () => {
    const onChange = vi.fn();
    render(<MoneyInput id="p" value="" onChange={onChange} currency="USD" />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "$1,90a0" } });
    expect(onChange).toHaveBeenCalledWith("1900");
  });

  it("allows one decimal point and no more", () => {
    const onChange = vi.fn();
    render(<MoneyInput id="p" value="" onChange={onChange} currency="USD" />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "19.0.0" } });
    expect(onChange).toHaveBeenCalledWith("19.00");
  });
});
