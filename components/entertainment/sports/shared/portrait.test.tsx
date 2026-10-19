// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Portrait } from "./portrait";

const FACE = "https://a.espncdn.com/combiner/i?img=/i/headshots/rpm/players/full/5829.png&w=96&h=96&scale=crop";
const FLAG = "https://a.espncdn.com/combiner/i?img=/i/teamlogos/countries/500/ita.png&w=96&h=96&scale=crop";

const sources = (container: HTMLElement): string[] =>
  [...container.querySelectorAll("img")].map((img) => img.getAttribute("src") ?? "");

describe("Portrait", () => {
  it("draws a face with its flag beside it", () => {
    const { container } = render(
      <Portrait subject={{ name: "K. Antonelli", imageUrl: FACE, flagUrl: FLAG }} />
    );
    // Straight off ESPN's CDN: it is already sized, and an allowlist would
    // break the day the path changes.
    expect(sources(container)).toEqual([FACE, FLAG]);
  });

  it("draws a team's logo, and no flag on it", () => {
    const { container } = render(
      <Portrait subject={{ name: "Mercedes", logoUrl: "/f1/teams/mercedes.png", flagUrl: FLAG }} />
    );
    const [logo, ...rest] = sources(container);
    expect(logo).toContain("mercedes.png");
    expect(rest).toEqual([]);
  });

  it("falls back to the livery for a team with no logo", () => {
    render(<Portrait subject={{ name: "Cadillac", color: "#2C3E50" }} />);
    expect(screen.getByText("CAD")).toHaveStyle({ backgroundColor: "#2C3E50", color: "#fff" });
  });

  it("draws the fallback it is given when there is no picture", () => {
    const { container } = render(
      <Portrait subject={{ name: "B. Shelton" }} fallback={<span>🇺🇸</span>} />
    );
    expect(screen.getByText("🇺🇸")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("swaps a picture that fails to load for the fallback", () => {
    const { container } = render(
      <Portrait
        subject={{ name: "A. Tapia", imageUrl: "https://media.padelapi.org/player-api/x.webp" }}
        fallback={<span>🇦🇷</span>}
      />
    );
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByText("🇦🇷")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
