// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { BracketMatch, Team } from "@/types/sports";

import { DrawMatchCard, playerEntry } from "./draw-match-card";

const players = new Map([
  playerEntry("alcaraz", "C. Alcaraz", "🇪🇸", 2),
  playerEntry("sinner", "J. Sinner", "🇮🇹", 1),
]);

const final = {
  id: "f",
  homeTeamId: "alcaraz",
  awayTeamId: "sinner",
  winnerTeamId: "alcaraz",
  date: "2025-09-07",
  legs: [
    { homeScore: 6, awayScore: 2 },
    { homeScore: 3, awayScore: 6 },
    { homeScore: 6, awayScore: 1 },
    { homeScore: 6, awayScore: 4 },
  ],
} as BracketMatch;

describe("DrawMatchCard", () => {
  it("reads the date as a calendar day, not a UTC instant", () => {
    // `new Date("2025-09-07")` is UTC midnight, which anybody west of
    // Greenwich renders as the 6th. A match is played on a date.
    render(<DrawMatchCard match={final} teams={players} />);
    expect(screen.getByText(/Sep 7/)).toBeInTheDocument();
  });

  it("shows every set for both players", () => {
    render(<DrawMatchCard match={final} teams={players} />);
    // 6–2 3–6 6–1 6–4: three sixes for Alcaraz and one for Sinner. Counting
    // every single digit would also catch the seed numbers beside the names.
    expect(screen.getAllByText("6")).toHaveLength(4);
    expect(screen.getAllByText("4")).toHaveLength(1);
  });

  it("says who is still in it", () => {
    render(<DrawMatchCard match={final} teams={players} />);
    expect(screen.getByText("C. Alcaraz").className).toContain("font-semibold");
    expect(screen.getByText("J. Sinner").className).not.toContain("font-semibold");
  });

  it("tells a screen reader who won and where each player is from, not only by bold and a hidden flag", () => {
    render(<DrawMatchCard match={final} teams={players} />);
    const tie = screen.getByRole("button");
    expect(tie).toHaveTextContent(/C\. Alcaraz, 🇪🇸, won/);
    expect(tie).toHaveTextContent(/J\. Sinner, 🇮🇹(?!, won)/);
    expect(screen.getAllByText(", won")).toHaveLength(1);
  });

  it("names no country for a player the provider has none for", () => {
    const unknown = new Map([
      playerEntry("alcaraz", "C. Alcaraz", "", 2),
      playerEntry("sinner", "J. Sinner", "🇮🇹", 1),
    ]);
    render(<DrawMatchCard match={final} teams={unknown} />);
    expect(screen.getByRole("button")).toHaveTextContent(/C\. Alcaraz, won/);
  });

  it("shows a player's photo, and keeps the flag for one without", () => {
    const photo = "https://a.espncdn.com/combiner/i?img=/i/headshots/tennis/players/full/3782.png&w=96&h=96&scale=crop";
    const withPhoto = new Map([
      playerEntry("alcaraz", "C. Alcaraz", "🇪🇸", 2, photo),
      playerEntry("sinner", "J. Sinner", "🇮🇹", 1),
    ]);
    const { container } = render(<DrawMatchCard match={final} teams={withPhoto} withFaces />);
    expect([...container.querySelectorAll("img")].map((i) => i.getAttribute("src"))).toEqual([photo]);
    // The flag rides on the photo as a badge, and stands alone without one.
    expect(screen.getByText("🇪🇸")).toBeInTheDocument();
    expect(screen.getByText("🇮🇹")).toBeInTheDocument();
  });

  it("draws no photos in a draw without any", () => {
    const { container } = render(<DrawMatchCard match={final} teams={players} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders an undecided tie without inventing a player", () => {
    render(
      <DrawMatchCard
        match={{ id: "x", homeTeamId: null, awayTeamId: null } as BracketMatch}
        teams={players}
      />
    );
    expect(screen.getAllByText("TBD")).toHaveLength(2);
  });
});

describe("DrawMatchCard, a padel pair", () => {
  const pair = (id: string, name: string, shortName: string, seed = ""): [string, Team] => [
    id,
    { id, name, shortName, code: seed },
  ];
  const pairs = new Map([
    pair("65-66", "A. Coello / A. Tapia", "Coello / Tapia", "1"),
    pair("84-88", "L. Augsburger / J. Lebron", "Augsburger / Lebron", "3"),
  ]);
  // Milano P1's final, as the provider scheduled it: 17:30 in Milan.
  const milanoFinal: BracketMatch = {
    id: "13991",
    homeTeamId: "65-66",
    awayTeamId: "84-88",
    winnerTeamId: "65-66",
    date: "2026-10-18T17:30:00+02:00",
    legs: [
      { homeScore: 4, awayScore: 6 },
      { homeScore: 6, awayScore: 3 },
      { homeScore: 7, awayScore: 6, awayTiebreak: 3 },
    ],
  };
  const inCostaRica = (match: BracketMatch) =>
    render(
      <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
        <DrawMatchCard match={match} teams={pairs} variant="pair" />
      </ReaderTimeZoneProvider>
    );

  it("stacks both players of each pair, with the seed and no flag", () => {
    const { container } = inCostaRica(milanoFinal);
    for (const name of ["Coello", "Tapia", "Augsburger", "Lebron"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    // The winning pair is the one in bold.
    expect(screen.getByText("Coello").parentElement!.className).toContain("font-semibold");
    expect(screen.getByText("Lebron").parentElement!.className).not.toContain("font-semibold");
  });

  it("dates the match by the reader's day and time, not Milan's", () => {
    inCostaRica(milanoFinal);
    // 17:30 in Milan is 9:30 in the morning in Costa Rica.
    expect(screen.getByText("Oct 18 · 9:30 AM")).toBeInTheDocument();
  });

  it("prints a set that went to a tie-break with the loser's points", () => {
    inCostaRica(milanoFinal);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getAllByText(/4–6 6–3 7–6\(3\)/).length).toBeGreaterThan(0);
  });

  it("opens the pairs' full names on a click or a tap, which a tooltip never did", () => {
    inCostaRica(milanoFinal);
    const tie = screen.getByRole("button");
    expect(tie).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(tie);
    expect(tie).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog")).toHaveTextContent("A. Coello / A. Tapia vs L. Augsburger / J. Lebron");
  });

  it("says which pair won", () => {
    inCostaRica(milanoFinal);
    expect(screen.getByRole("button")).toHaveTextContent(/Coello.*Tapia, won/);
    expect(screen.getAllByText(", won")).toHaveLength(1);
  });

  it("says a tie was a walkover rather than inventing a score", () => {
    inCostaRica({
      ...milanoFinal,
      legs: undefined,
      outcome: "walkover",
      date: "2026-10-15",
      winnerTeamId: "84-88",
    });
    expect(screen.getByText("Thu, Oct 15 · Walkover")).toBeInTheDocument();
  });

  it("puts both players' faces by the pair, and an initial for one that will not load", () => {
    const withPhotos = new Map(
      [...pairs].map(([id, pair]) => [
        id,
        {
          ...pair,
          photos: pair.shortName.split(" / ").map((s) => `https://media.padelapi.org/player-api/${s.toLowerCase()}.webp`),
        },
      ])
    );
    const { container } = render(
      <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
        <DrawMatchCard match={milanoFinal} teams={withPhotos} variant="pair" withFaces />
      </ReaderTimeZoneProvider>
    );
    const images = [...container.querySelectorAll("img")];
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "https://media.padelapi.org/player-api/coello.webp",
      "https://media.padelapi.org/player-api/tapia.webp",
      "https://media.padelapi.org/player-api/augsburger.webp",
      "https://media.padelapi.org/player-api/lebron.webp",
    ]);
    fireEvent.error(images[3]);
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  it("names a bye where the missing pair would be, and only there", () => {
    inCostaRica({
      ...milanoFinal,
      awayTeamId: null,
      legs: undefined,
      outcome: "bye",
      date: "2026-10-26",
      winnerTeamId: "65-66",
    });
    expect(screen.getByText("Bye")).toBeInTheDocument();
    expect(screen.queryByText("TBD")).toBeNull();
    expect(screen.getByText("Mon, Oct 26")).toBeInTheDocument();
  });
});
