// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChangeTimeline } from "./change-timeline";

describe("ChangeTimeline", () => {
  it("draws where things were and where they go on one strip of days", () => {
    const { container, getByText } = render(
      <ChangeTimeline
        lines={[
          // The cruise moves ahead of the hotel: ten days in all.
          {
            action: "change",
            subject: "item",
            tripTitle: "Orlando",
            title: "Cruise",
            before: { from: "2027-01-17", to: "2027-01-24" },
            after: { from: "2027-01-15", to: "2027-01-22" },
          },
          { action: "remove", subject: "item", tripTitle: "Orlando", title: "Hotel", before: { from: "2027-01-15", to: "2027-01-16" } },
          { action: "add", subject: "member", tripTitle: "Orlando", title: "Ana" },
        ]}
      />
    );
    expect(getByText("Jan 15, 2027")).toBeInTheDocument();
    expect(getByText("Jan 24, 2027")).toBeInTheDocument();
    // The member has no days, so it is not on the strip.
    const tracks = container.querySelectorAll<HTMLElement>(".relative.h-3");
    expect(tracks).toHaveLength(2);
    const [was, now] = tracks[0].querySelectorAll<HTMLElement>("span");
    expect([was.style.left, was.style.width]).toEqual(["20%", "80%"]);
    expect([now.style.left, now.style.width]).toEqual(["0%", "80%"]);
  });

  it("places one new day within the trip's own days", () => {
    const { container } = render(
      <ChangeTimeline
        lines={[
          {
            action: "add",
            subject: "item",
            tripTitle: "Orlando",
            title: "Islands of Adventure",
            tripSpan: { from: "2027-01-16", to: "2027-01-24" },
            after: { from: "2027-01-18", to: "2027-01-18" },
          },
        ]}
      />
    );
    const bar = container.querySelector<HTMLElement>(".relative.h-3 span")!;
    // The 18th is the third of nine days.
    expect(bar.style.left).toBe(`${(2 / 9) * 100}%`);
    expect(bar.style.width).toBe(`${(1 / 9) * 100}%`);
  });

  it("draws nothing for a proposal that moves no days", () => {
    const { container } = render(
      <ChangeTimeline lines={[{ action: "add", subject: "photo", tripTitle: "Orlando", title: "Photo" }]} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
