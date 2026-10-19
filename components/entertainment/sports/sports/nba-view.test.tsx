// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NBA_DATA } from "@/lib/data/sports/nba";
import type { NbaData } from "@/types/sports";

import { NbaView } from "./nba-view";

const postseason = () => screen.getByRole("tab", { name: "Postseason" });
const openTab = () => screen.getByRole("tab", { selected: true }).textContent;

describe("NbaView", () => {
  it("shows the Postseason tab locked while there is no bracket", () => {
    render(<NbaView data={{ ...NBA_DATA, playoffs: [] }} />);
    expect(openTab()).toBe("Overview");
    expect(postseason()).toBeDisabled();
    expect(postseason().querySelector("svg")).not.toBeNull();
  });

  it("opens on the bracket once the postseason has one", () => {
    const [home, away] = NBA_DATA.teams;
    const data: NbaData = {
      ...NBA_DATA,
      playoffs: [
        {
          id: "final",
          label: "NBA Finals",
          matches: [
            {
              id: "nba-final",
              homeTeamId: home.id,
              awayTeamId: away.id,
              homeScore: 4,
              awayScore: 1,
              winnerTeamId: home.id,
              bestOf: 7,
            },
          ],
        },
      ],
    };
    render(<NbaView data={data} />);
    expect(openTab()).toBe("Postseason");
    expect(postseason()).toBeEnabled();
    expect(postseason().querySelector("svg")).toBeNull();
    expect(screen.getByText("NBA Finals")).toBeInTheDocument();
  });
});
