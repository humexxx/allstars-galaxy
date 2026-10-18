import { describe, expect, it } from "vitest";

import { __testing } from "./padel-api-service";

const { mapStatus, mapTournament, shortNameFor, tournamentsPath } = __testing;

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
