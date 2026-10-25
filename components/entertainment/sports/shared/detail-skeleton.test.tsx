// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RacePageSkeleton, TournamentPageSkeleton } from "./detail-skeleton";

describe.each([
  { name: "RacePageSkeleton", Skeleton: RacePageSkeleton, message: "Loading race…" },
  { name: "TournamentPageSkeleton", Skeleton: TournamentPageSkeleton, message: "Loading tournament…" },
])("$name", ({ Skeleton, message }) => {
  it("says the page is loading, outside the picture it hides from a screen reader", () => {
    const { container } = render(<Skeleton />);
    // getByRole skips anything under aria-hidden, so finding it is the point.
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
