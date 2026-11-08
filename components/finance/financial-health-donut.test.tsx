// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinancialHealthDonut } from "./financial-health-donut";

describe("FinancialHealthDonut", () => {
  it("names and colours the period by its band", () => {
    render(<FinancialHealthDonut obligations={10_475} income={21_000} />);
    const gauge = screen.getByRole("img", { name: "Healthy, 50% obligations to income" });
    expect(gauge.querySelectorAll("circle")[1].getAttribute("stroke")).toBe("var(--health-healthy)");
  });

  it("calls spending past income underwater", () => {
    render(<FinancialHealthDonut obligations={2_500} income={2_000} />);
    expect(screen.getByRole("img", { name: "Underwater, 125% obligations to income" })).toBeTruthy();
  });

  it("stays neutral without income", () => {
    render(<FinancialHealthDonut obligations={500} income={0} />);
    expect(screen.getByRole("img", { name: "No income, no income obligations to income" })).toBeTruthy();
  });
});
