// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { F1_CIRCUIT_OUTLINES, F1_CIRCUIT_VIEWBOX } from "@/lib/data/sports/f1-circuits";

import { F1CircuitOutline } from "./f1-circuit-outline";

describe("F1CircuitOutline", () => {
  it("draws the track as one line in the text colour, hidden from assistive tech", () => {
    const { container } = render(<F1CircuitOutline circuitId="monaco" className="size-12" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", F1_CIRCUIT_VIEWBOX);
    expect(svg).toHaveClass("size-12");

    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(1);
    expect(paths[0]).toHaveAttribute("d", F1_CIRCUIT_OUTLINES.monaco);
    expect(paths[0]).toHaveAttribute("stroke", "currentColor");
    expect(paths[0]).toHaveAttribute("fill", "none");
  });

  it("draws nothing for a circuit with no outline, not an empty box", () => {
    const { container } = render(<F1CircuitOutline circuitId="kyalami" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not mistake an object's own machinery for a circuit", () => {
    const { container } = render(<F1CircuitOutline circuitId="constructor" />);
    expect(container).toBeEmptyDOMElement();
  });
});
