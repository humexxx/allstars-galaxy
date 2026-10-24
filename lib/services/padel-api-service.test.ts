import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BracketMatch } from "@/types/sports";

import milanoDraw from "./__fixtures__/padel-milano-p1-2026-matches.json";
import { __testing, getPadelData, getPadelDraw } from "./padel-api-service";

const {
  mapStatus,
  mapTournament,
  mapRanking,
  shortNameFor,
  photoFor,
  tournamentsPath,
  calendarEntry,
  pairOf,
  setScore,
  drawFrom,
  drawsFrom,
  fetchPadelDraws,
} = __testing;

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
  venue: { name: "Allianz Cloud Milano" },
  photo_url: "https://media.padelapi.org/tournament-api/milano-p1-2026-3f661cc3.webp",
  prize: { amount: 479068, currency: "EUR" },
  winners: {
    men: [{ name: "Arturo Coello" }, { name: "Agustin Tapia" }],
    women: [{ name: "Ariana Sanchez Fallada" }, { name: "Andrea Ustero Prieto" }],
  },
};

// The first page of `/tournaments/747/matches?sort_by=round&order_by=asc`:
// the final down to the round of 16 for both categories, then part of the
// round of 32 — trimmed to the fields the mapper reads.
type FixtureMatch = Parameters<typeof drawFrom>[1][number];
const MATCHES = milanoDraw.data as FixtureMatch[];
const ID = "padelapi-747";

const men = () => drawFrom(ID, MATCHES, "men");
const women = () => drawFrom(ID, MATCHES, "women");
const without = (drop: (m: FixtureMatch) => boolean) => MATCHES.filter((m) => !drop(m));
const pairId = (m: FixtureMatch, side: "team_1" | "team_2") => pairOf(m.players?.[side])!.id;
const fixture = (category: string, round: number, index: number) =>
  MATCHES.find((m) => m.category === category && m.round === round && m.index === index)!;
/** The same draw before a ball is struck: the round of 16 on, nobody named. */
const dayOne: FixtureMatch[] = MATCHES.map((m) => ({
  ...m,
  score: null,
  winner: null,
  status: "scheduled",
  ...(m.round <= 8 && { players: { team_1: [], team_2: [] } }),
}));

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

  it("carries the tier, the poster, the arena and the prize money", () => {
    expect(mapTournament(milano, "men")).toMatchObject({
      tier: "P1",
      imageUrl: milano.photo_url,
      venue: "Allianz Cloud Milano",
      prize: { amount: 479068, currency: "EUR" },
    });
  });

  it("leaves out what the provider has not published", () => {
    // Kuwait P1: no poster, no arena yet.
    const kuwait = mapTournament(
      { ...milano, level: "major", photo_url: null, venue: null, prize: null },
      "men"
    );
    expect(kuwait.tier).toBe("Major");
    expect(kuwait.imageUrl).toBeUndefined();
    expect(kuwait.venue).toBeUndefined();
    expect(kuwait.prize).toBeUndefined();
  });
});

describe("calendarEntry", () => {
  it("is the tournament without its draw, under the same id", () => {
    expect(calendarEntry(milano, "women")).toEqual({
      id: "padelapi-747",
      name: "Milano P1 2026",
      startDate: "2026-10-12",
      endDate: "2026-10-18",
      status: "completed",
      champion: "A. Sanchez / A. Ustero",
    });
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
  it("asks for this season of Premier Padel in one page, oldest first", () => {
    const params = new URLSearchParams(
      tournamentsPath(new Date("2026-10-18T12:00:00Z")).split("?")[1]
    );
    expect(params.get("level")).toBe("major,p1,p2,finals");
    expect(params.get("after_date")).toBe("2026-01-01");
    expect(params.get("sort_by")).toBe("start_date");
    expect(params.get("order_by")).toBe("asc");
    // `per_page` is the API's page size; `limit` is ignored. 50 is its most.
    expect(params.get("per_page")).toBe("50");
  });

  it("reaches back into December while the new season is a few weeks old", () => {
    const params = new URLSearchParams(
      tournamentsPath(new Date("2027-01-20T12:00:00Z")).split("?")[1]
    );
    expect(params.get("after_date")).toBe("2026-12-06");
  });
});

describe("pairOf", () => {
  const coello = { id: 65, name: "Arturo Coello", connections: { pair: "/api/pairs/65-66" } };
  const tapia = { id: 66, name: "Agustin Tapia", connections: { pair: "/api/pairs/65-66" } };

  it("is the same pair whichever order the match lists them in", () => {
    // The final sends Coello / Tapia, the quarter-final Tapia / Coello.
    expect(pairOf([tapia, coello], "1")).toEqual(pairOf([coello, tapia], "1"));
    expect(pairOf([tapia, coello], "1")).toEqual({
      id: "65-66",
      name: "A. Coello / A. Tapia",
      shortName: "Coello / Tapia",
      code: "1",
    });
  });

  it("keys a pair by its players, whatever the provider's link says", () => {
    // The link follows the match's order: "66-65" in Milano's quarter-final.
    const link = { pair: "/api/pairs/434-433" };
    expect(
      pairOf([
        { id: 434, name: "Delfina Brea Senesi", connections: link },
        { id: 433, name: "Gemma Triay Pons", connections: link },
      ])
    ).toMatchObject({ id: "433-434", shortName: "Triay / Brea", code: "" });
  });

  it("is nobody for an empty side — a bye", () => {
    expect(pairOf([])).toBeNull();
    expect(pairOf(null)).toBeNull();
  });
});

describe("setScore", () => {
  it("reads the games and keeps the tie-break", () => {
    expect(setScore("6(1)")).toEqual({ games: 6, tiebreak: 1 });
    expect(setScore("7")).toEqual({ games: 7, tiebreak: null });
    expect(setScore(null)).toEqual({ games: null, tiebreak: null });
  });
});

describe("drawFrom", () => {
  it("starts at the round of 16 and runs to the final, every slot in index order", () => {
    const draw = men();
    expect(draw.rounds.map((r) => [r.id, r.label, r.matches.length])).toEqual([
      ["round-of-16", "Round of 16", 8],
      ["quarter-final", "Quarter-finals", 4],
      ["semi-final", "Semi-finals", 2],
      ["final", "Final", 1],
    ]);
    // Index order is the bracket's own order: slot i plays slot i / 2 next.
    const qf = MATCHES.filter((m) => m.category === "men" && m.round === 4)
      .sort((a, b) => a.index - b.index)
      .map((m) => String(m.id));
    expect(draw.rounds[1].matches.map((m) => m.id)).toEqual(qf);
  });

  it("feeds every winner into the slot the next round has for it", () => {
    // Held for every link in the real draw: (round, i) → (round / 2, i / 2),
    // on top when i is even.
    for (const draw of [men(), women()]) {
      for (let r = 0; r < draw.rounds.length - 1; r++) {
        draw.rounds[r].matches.forEach((m: BracketMatch, i) => {
          if (!m.winnerTeamId) return;
          const next = draw.rounds[r + 1].matches[Math.floor(i / 2)];
          expect(i % 2 === 0 ? next.homeTeamId : next.awayTeamId).toBe(m.winnerTeamId);
        });
      }
    }
  });

  it("names the champions and the runners-up from the final", () => {
    expect(men()).toMatchObject({
      champion: "A. Coello / A. Tapia",
      runnerUp: "L. Augsburger / J. Lebron",
    });
    expect(women().champion).toBe("A. Sanchez / A. Ustero");
  });

  it("reads each set's games and keeps the tie-break", () => {
    // Augsburger / Lebron d. Garrido / De Pascual 7–6(1) 6–3.
    const qf = men().rounds[1].matches[2];
    expect(qf.legs).toEqual([
      { homeScore: 7, awayScore: 6, awayTiebreak: 1 },
      { homeScore: 6, awayScore: 3 },
    ]);
  });

  it("carries the pairs with their seeds, and only the ones in the bracket", () => {
    const draw = men();
    const byId = new Map(draw.players.map((p) => [p.id, p]));
    expect(byId.get("65-66")).toMatchObject({ shortName: "Coello / Tapia", code: "1" });
    const inBracket = new Set(
      draw.rounds.flatMap((r) => r.matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]))
    );
    expect(draw.players.every((p) => inBracket.has(p.id))).toBe(true);
    // A pair knocked out in the round of 32 is not in the bracket at all.
    expect(byId.has(pairId(fixture("men", 16, 1), "team_1"))).toBe(false);
  });

  it("marks a walkover and a retirement, and keeps their winners", () => {
    const w = women();
    const walkover = w.rounds[0].matches[5];
    expect(walkover).toMatchObject({ outcome: "walkover", legs: undefined });
    expect(walkover.winnerTeamId).toBe(walkover.awayTeamId);
    const retired = w.rounds[1].matches[3];
    expect(retired.outcome).toBe("retired");
    expect(retired.winnerTeamId).toBe(retired.awayTeamId);
  });

  it("fills a round not yet published from the winners before it", () => {
    // Mid-tournament: the quarter-finals are played, the semi-finals not yet listed.
    const draw = drawFrom(ID, without((m) => m.round <= 2), "men");
    const [sf1, sf2] = draw.rounds[2].matches;
    expect(sf1.homeTeamId).toBe("65-66");
    expect(sf1.awayTeamId).toBe(pairId(fixture("men", 4, 1), "team_2"));
    expect(sf2.homeTeamId).toBe(pairId(fixture("men", 4, 2), "team_1"));
    // Nobody has won a semi-final, so the final is still to be drawn.
    expect(draw.rounds[3].matches[0]).toMatchObject({ homeTeamId: null, awayTeamId: null });
    expect(draw.champion).toBeUndefined();
  });

  it("seeds the round of 16 from the round of 32, byes included", () => {
    // Only part of the round of 32 is here, so the round of 16 is not all
    // known: the draw opens on the round of 32.
    const draw = drawFrom(ID, without((m) => m.round <= 8), "women");
    expect(draw.rounds[0].id).toBe("round-of-32");
    // Triay / Brea had a bye in the round of 32, which says so: still through, on top.
    expect(draw.rounds[0].matches[0].outcome).toBe("bye");
    expect(draw.rounds[1].matches[0].homeTeamId).toBe("433-434");
    expect(draw.rounds[1].matches[0].awayTeamId).toBe(pairId(fixture("women", 16, 1), "team_2"));
  });

  it("opens on the first round while the round of 16 is still being filled", () => {
    // Day one: the draw is out, nothing played, the round of 16 empty.
    const draw = drawFrom(ID, dayOne, "men");
    expect(draw.rounds.map((r) => r.id)).toEqual([
      "round-of-32",
      "round-of-16",
      "quarter-final",
      "semi-final",
      "final",
    ]);
    expect(draw.rounds[0].matches.some((m) => m.homeTeamId && m.awayTeamId)).toBe(true);
    expect(draw.rounds[1].matches.every((m) => !m.homeTeamId && !m.awayTeamId)).toBe(true);
  });

  it("shows only the champions when the free plan hides the results", () => {
    const hidden = MATCHES.map((m) => ({ ...m, score: "hidden_free_plan", winner: "hidden_free_plan" }));
    expect(drawFrom(ID, hidden, "men")).toEqual({
      tournamentId: ID,
      rounds: [],
      players: [],
      resultsHidden: true,
    });
  });

  it("starts at the quarter-finals for an event that has no round of 16", () => {
    const finals = drawFrom(ID, without((m) => m.round > 4), "men");
    expect(finals.rounds.map((r) => r.id)).toEqual(["quarter-final", "semi-final", "final"]);
  });

  it("has nothing to draw before the matches are published", () => {
    expect(drawFrom(ID, [], "men")).toEqual({ tournamentId: ID, rounds: [], players: [] });
  });
});

describe("drawsFrom", () => {
  it("splits one list into both categories' draws", () => {
    const draws = drawsFrom(747, MATCHES);
    expect(draws.men.rounds[3].matches[0].id).toBe("13991");
    expect(draws.women.tournamentId).toBe("padelapi-747");
    expect(draws.women.rounds[0].matches).toHaveLength(8);
  });
});

describe("the feed and the draws on demand", () => {
  const player = { id: 65, name: "Arturo Coello", nationality: "ES", ranking: 1, ranking_diff: 0, points: 11250 };
  const kuwait = { ...milano, id: 748, name: "Kuwait P1 2026", status: "pending", start_date: "2026-10-26", end_date: "2026-10-31", winners: null };
  const madrid = { ...milano, id: 701, name: "Madrid P1 2026", start_date: "2026-04-06", end_date: "2026-04-12" };
  // Madrid's results are past the free plan's six months.
  const hidden = MATCHES.map((m) => ({ ...m, score: "hidden_free_plan", winner: "hidden_free_plan" }));

  const respond = (body: unknown): Response => ({ ok: true, json: async () => body }) as Response;
  const fetchMock = vi.fn<(url: string) => Promise<Response>>(async (url) => {
    if (url.includes("/rankings")) return respond({ data: [player] });
    if (url.includes("/tournaments/747/matches")) return respond({ data: MATCHES });
    if (url.includes("/tournaments/701/matches")) return respond({ data: hidden });
    if (url.includes("/tournaments?")) return respond({ data: [madrid, milano, kuwait] });
    return { ok: false, status: 404 } as Response;
  });
  const drawCalls = (): string[] =>
    fetchMock.mock.calls.map(([url]) => url).filter((url) => url.includes("/matches"));

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-10-18T12:00:00Z"), toFake: ["Date"] });
    vi.stubEnv("PADEL_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockClear();
  });

  it("ships the current draw, and looks for the next one only once it can exist", async () => {
    const data = await getPadelData();
    const byId = new Map(data.men.tournaments.map((t) => [t.id, t]));
    expect(byId.get("padelapi-747")!.bracket!.map((r) => r.id)).toEqual([
      "round-of-16",
      "quarter-final",
      "semi-final",
      "final",
    ]);
    expect(byId.get("padelapi-747")!.runnerUp).toBe("L. Augsburger / J. Lebron");
    expect(byId.get("padelapi-748")!.bracket).toBeUndefined();
    // Kuwait starts in eight days: no request is spent on a draw not made yet.
    expect(drawCalls().some((url) => url.includes("/748/"))).toBe(false);
    expect(data.men.drawPlayers!.find((p) => p.id === "65-66")!.shortName).toBe("Coello / Tapia");
    expect(data.men.calendar!.map((t) => t.id)).toEqual(["padelapi-701", "padelapi-747", "padelapi-748"]);
  });

  it("reads one category's draw for the sheet", async () => {
    const draw = await getPadelDraw("wpt-women", "padelapi-747");
    expect(draw!.champion).toBe("A. Sanchez / A. Ustero");
    expect(draw!.rounds).toHaveLength(4);
  });

  it("names the champions of a draw whose results the free plan hides", async () => {
    expect(await getPadelDraw("wpt-men", "padelapi-701")).toMatchObject({
      rounds: [],
      resultsHidden: true,
      champion: "A. Coello / A. Tapia",
    });
  });

  it("has no draw yet for a tournament more than a few days off, and asks nobody", async () => {
    expect(await getPadelDraw("wpt-men", "padelapi-748")).toEqual({
      tournamentId: "padelapi-748",
      rounds: [],
      players: [],
    });
    expect(drawCalls().some((url) => url.includes("/748/"))).toBe(false);
  });

  it("reads the rest of a draw while its round of 16 is being filled, and only then", async () => {
    const pages = vi.fn<(url: string) => Promise<Response>>(async (url) =>
      respond(url.includes("page=1") ? { data: dayOne, meta: { last_page: 3 } } : { data: [] })
    );
    vi.stubGlobal("fetch", pages);
    await fetchPadelDraws(748);
    expect(pages.mock.calls.map(([url]) => new URL(url).searchParams.get("page"))).toEqual(["1", "2", "3"]);

    pages.mockClear();
    pages.mockImplementation(async () => respond({ data: MATCHES, meta: { last_page: 3 } }));
    await fetchPadelDraws(747);
    expect(pages).toHaveBeenCalledTimes(1);
  });

  it("asks for no tournament this season's calendar does not list", async () => {
    expect(await getPadelDraw("wpt-men", "padelapi-999")).toBeNull();
    expect(drawCalls().some((url) => url.includes("/999/"))).toBe(false);
  });
});
