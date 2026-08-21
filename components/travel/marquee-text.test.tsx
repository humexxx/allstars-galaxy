// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MarqueeText } from "./marquee-text";

/** jsdom reports every width as 0, so the two cases are staged by hand. */
function stageWidths({ text, box }: { text: number; box: number }) {
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get() {
      return this.dataset.marquee === undefined && this.parentElement ? text : text;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return box;
    },
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
});

describe("MarqueeText", () => {
  it("leaves a label that already fits completely alone", () => {
    // Nothing to reveal, and a label that drifts for no reason is noise.
    stageWidths({ text: 40, box: 100 });
    render(<MarqueeText>Hotel</MarqueeText>);

    const box = screen.getByText("Hotel").parentElement!;
    expect(box.getAttribute("data-marquee")).toBeNull();
    expect(screen.getByText("Hotel").className).toContain("truncate");
  });

  it("measures how far a long label has to travel", () => {
    stageWidths({ text: 300, box: 100 });
    render(<MarqueeText>Star of the Seas — Western Caribbean</MarqueeText>);

    const label = screen.getByText("Star of the Seas — Western Caribbean");
    const box = label.parentElement!;
    expect(box.getAttribute("data-marquee")).toBe("true");
    expect(box.style.getPropertyValue("--marquee-shift")).toBe("-200px");
    // Distance and pace travel together, so a long title is not slower to
    // read than a short one.
    expect(box.style.getPropertyValue("--marquee-duration")).toBe("6.666666666666667s");
    expect(label.className).toContain("w-max");
  });

  it("never animates faster than the eye can follow", () => {
    stageWidths({ text: 110, box: 100 });
    render(<MarqueeText>Just over</MarqueeText>);

    const box = screen.getByText("Just over").parentElement!;
    expect(box.style.getPropertyValue("--marquee-duration")).toBe("1.5s");
  });
});
