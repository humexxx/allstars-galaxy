// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UnitArithmetic } from "./unit-arithmetic";

describe("UnitArithmetic", () => {
  it("shows the unit price and how many times it applies", () => {
    const { container } = render(
      <UnitArithmetic low={100} high={150} unit="per_night" times={2} currency="USD" />
    );
    expect(container.textContent).toBe("$100–$150 / night × 2");
  });

  it("shows a single figure when there is no range", () => {
    const { container } = render(
      <UnitArithmetic low={1900} high={1900} unit="per_person" times={4} currency="USD" />
    );
    expect(container.textContent).toBe("$1,900 / person × 4");
  });

  it("names the unit alone when it applies once", () => {
    const { container } = render(
      <UnitArithmetic low={120} high={120} unit="per_night" times={1} currency="USD" />
    );
    expect(container.textContent).toBe("/ night");
  });

  it("says nothing under a plain total", () => {
    const { container } = render(
      <UnitArithmetic low={600} high={800} unit="total" times={1} currency="USD" />
    );
    expect(container.textContent).toBe("");
  });
});
