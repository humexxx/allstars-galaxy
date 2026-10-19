import { describe, expect, it } from "vitest";

import { __testing } from "./padel-api-service";

const { mapStatus, mapTournament, mapRanking, shortNameFor, photoFor, tournamentsPath } = __testing;

// Milano P1 2026 as the API returns it, trimmed to what the mapper reads.
const milano = {
  id: 747,
  name: "Milano P1 2026",
  location: "Milan",
  country: "IT",
  level: "p1",
  status: "finished" as const,
  start_date: "2026-10-12",
  end_date: "2026-10-18",
  winners: {
    men: [{ name: "Arturo Coello" }, { name: "Agustin Tapia" }],
    women: [{ name: "Ariana Sanchez Fallada" }, { name: "Andrea Ustero Prieto" }],
  },
};

describe("mapStatus", () => {
  it("reads the provider's current state names", () => {
    // They were renamed from in_progress / completed; read as the old names,
    // every tournament came out "upcoming".
    expect(mapStatus("live")).toBe("live");
    expect(mapStatus("finished")).toBe("completed");
    expect(mapStatus("pending")).toBe("upcoming");
  });

  it("still understands the old ones", () => {
    expect(mapStatus("in_progress")).toBe("live");
    expect(mapStatus("completed")).toBe("completed");
  });
});

describe("mapTournament", () => {
  it("names each category's own champions", () => {
    expect(mapTournament(milano, "men")).toMatchObject({
      status: "completed",
      location: "Milan",
      champion: "A. Coello / A. Tapia",
    });
    expect(mapTournament(milano, "women").champion).toBe("A. Sanchez / A. Ustero");
  });

  it("leaves the champion out before the final", () => {
    expect(
      mapTournament({ ...milano, status: "pending", winners: null }, "men").champion
    ).toBeUndefined();
  });
});

describe("shortNameFor", () => {
  it("uses the first of two surnames, the one a player goes by", () => {
    expect(shortNameFor("Gemma Triay Pons")).toBe("G. Triay");
    expect(shortNameFor("Alejandra Alonso De Villa")).toBe("A. Alonso");
  });

  it("keeps a particle with the name it belongs to", () => {
    expect(shortNameFor("Martin Di Nenno")).toBe("M. Di Nenno");
  });

  it("leaves a single surname alone", () => {
    expect(shortNameFor("Agustin Tapia")).toBe("A. Tapia");
    expect(shortNameFor("Momo")).toBe("Momo");
  });
});

describe("photoFor", () => {
  it("spells the address the player record serves as photo_url", () => {
    // `/players/66` answers photo_url ".../player-api/agustin-tapia.webp".
    expect(photoFor("Agustin Tapia")).toBe(
      "https://media.padelapi.org/player-api/agustin-tapia.webp"
    );
  });

  it("keeps both surnames and particles, and drops accents", () => {
    expect(photoFor("Gemma Triay Pons")).toBe(
      "https://media.padelapi.org/player-api/gemma-triay-pons.webp"
    );
    expect(photoFor("Alejandra Alonso De Villa")).toBe(
      "https://media.padelapi.org/player-api/alejandra-alonso-de-villa.webp"
    );
    expect(photoFor("Agustín Tapia")).toBe(
      "https://media.padelapi.org/player-api/agustin-tapia.webp"
    );
  });

  it("has nothing for a blank name", () => {
    expect(photoFor("  ")).toBeUndefined();
  });
});

describe("mapRanking", () => {
  it("puts the photo on the ranking row", () => {
    // The rankings row as the API returns it, trimmed.
    const row = mapRanking({
      id: 66,
      name: "Agustin Tapia",
      category: "men",
      nationality: "AR",
      ranking: 1,
      ranking_diff: 0,
      points: 19840,
    });
    expect(row).toMatchObject({
      position: 1,
      shortName: "A. Tapia",
      flagEmoji: "🇦🇷",
      photoUrl: "https://media.padelapi.org/player-api/agustin-tapia.webp",
    });
  });
});

describe("tournamentsPath", () => {
  it("asks for Premier Padel only, recent and upcoming, oldest first", () => {
    const params = new URLSearchParams(
      tournamentsPath(new Date("2026-10-18T12:00:00Z")).split("?")[1]
    );
    expect(params.get("level")).toBe("major,p1,p2,finals");
    expect(params.get("after_date")).toBe("2026-09-03");
    expect(params.get("sort_by")).toBe("start_date");
    expect(params.get("order_by")).toBe("asc");
    // `per_page` is the API's page size; `limit` is ignored.
    expect(params.get("per_page")).toBe("20");
  });
});
