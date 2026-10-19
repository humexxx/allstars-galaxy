// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { F1_DATA } from "@/lib/data/sports/f1";

import { F1View } from "./f1-view";

const tabs = () => screen.getAllByRole("tab").map((t) => t.textContent);
const openTab = () => screen.getByRole("tab", { selected: true }).textContent;
const championship = (name: "Drivers" | "Constructors") => screen.getByRole("radio", { name });

describe("F1View", () => {
  it("has one Standings tab where Drivers and Constructors were", () => {
    render(<F1View data={F1_DATA} />);
    expect(tabs()).toEqual(["Standings", "Races"]);
    expect(openTab()).toBe("Standings");
    expect(championship("Drivers")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("columnheader", { name: "Driver" })).toBeInTheDocument();
  });

  it("swaps the table between the championships, columns and badges included", () => {
    render(<F1View data={F1_DATA} />);
    fireEvent.click(championship("Constructors"));

    expect(championship("Constructors")).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("columnheader", { name: "Driver" })).toBeNull();
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "#",
      "Team",
      "Points",
      "Wins",
      "Podiums",
    ]);
    // No logo in the fixture, so the livery disc stands in.
    expect(screen.getByText("MER")).toBeInTheDocument();

    fireEvent.click(championship("Drivers"));
    expect(screen.getByText("A.K. Antonelli")).toBeInTheDocument();
  });

  it.each([
    ["drivers", "Drivers", "Driver"],
    ["constructors", "Constructors", "Team"],
  ] as const)("opens an old ?tab=%s link on Standings, on that table", (tab, mode, column) => {
    render(<F1View data={F1_DATA} initialTab={tab} />);
    expect(openTab()).toBe("Standings");
    expect(championship(mode)).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
  });

  it("falls back to Standings for ?tab=news when there is no news", () => {
    render(<F1View data={F1_DATA} initialTab="news" />);
    expect(openTab()).toBe("Standings");
  });
});
