// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TeamBadge } from "./team-badge";

const team = (primaryColor?: string) => ({
  name: "San Antonio Spurs",
  shortName: "Spurs",
  code: "SAS",
  primaryColor,
  logoUrl: undefined,
});

describe("TeamBadge", () => {
  it("uses dark ink on a pale club colour", () => {
    // The Spurs' silver rendered white-on-white before the badge asked what
    // could actually be read on it.
    render(<TeamBadge team={team("#C4CED4")} />);
    expect(screen.getByTitle("San Antonio Spurs")).toHaveStyle({ color: "#111" });
  });

  it("keeps white ink on a dark one", () => {
    render(<TeamBadge team={team("#0C2340")} />);
    expect(screen.getByTitle("San Antonio Spurs")).toHaveStyle({ color: "#fff" });
  });

  it("picks whichever ink reads better, so mid-light colours take the dark one", () => {
    // Real Madrid's gold and City's sky blue carried white at 1.7:1 and 2.3:1.
    for (const colour of ["#FEBE10", "#6CABDD"]) {
      const { unmount } = render(<TeamBadge team={team(colour)} />);
      expect(screen.getByTitle("San Antonio Spurs")).toHaveStyle({ color: "#111" });
      unmount();
    }
    // Arsenal's red sits just past the switch: white still reads better on it.
    render(<TeamBadge team={team("#EF0107")} />);
    expect(screen.getByTitle("San Antonio Spurs")).toHaveStyle({ color: "#fff" });
  });

  it("falls back to white when a team has no colour at all", () => {
    render(<TeamBadge team={team(undefined)} />);
    expect(screen.getByTitle("San Antonio Spurs")).toHaveStyle({ color: "#fff" });
  });
});
