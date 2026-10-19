/**
 * A fake Lolesports API for the season-boundary tests: the leagues, their
 * tournaments, standings and schedule pages as the API serves them on a given
 * day. Dates and the regional finals are the real 2026 ones (checked against
 * the API on 2026-10-18); Worlds 2026's results are made up, and so is the
 * 2027 calendar's shape, which nobody lists yet.
 */

type Score = [number, number];

type Spec = {
  id: string;
  at: string;
  block: string;
  home: string;
  away: string;
  /** The result, applied once `at` has passed. */
  score: Score;
  bestOf: 1 | 3 | 5;
  /** When the pairing is known; TBD before. */
  drawn?: string;
};

type Tournament = { id: string; slug: string; startDate: string; endDate: string };

const LEAGUES = [
  { id: "worlds", slug: "worlds", name: "Worlds" },
  { id: "msi", slug: "msi", name: "MSI" },
  { id: "first_stand", slug: "first_stand", name: "First Stand" },
  { id: "lec", slug: "lec", name: "LEC" },
  { id: "lcs", slug: "lcs", name: "LCS" },
  { id: "lck", slug: "lck", name: "LCK" },
  { id: "lpl", slug: "lpl", name: "LPL" },
].map((l) => ({ ...l, region: "", image: "" }));

const NAMES: Record<string, string> = {
  AL: "Anyone's Legend",
  BLG: "Bilibili Gaming",
  G2: "G2 Esports",
  GEN: "Gen.G",
  HLE: "Hanwha Life Esports",
  MKOI: "Movistar KOI",
  TLAW: "Team Liquid",
};

const logo = (code: string): string => `https://static.lolesports.com/teams/${code}.png`;

function teams(spec: Spec, now: string): object[] {
  const drawn = !spec.drawn || spec.drawn <= now;
  const played = spec.at <= now;
  return [spec.home, spec.away].map((code, side) => {
    if (!drawn) return { name: "TBD", code: "TBD" };
    const wins = spec.score[side];
    const other = spec.score[1 - side];
    return {
      name: NAMES[code] ?? code,
      code,
      image: logo(code),
      ...(played
        ? { result: { outcome: wins > other ? "win" : "loss", gameWins: wins } }
        : { result: { outcome: null, gameWins: 0 } }),
    };
  });
}

function state(spec: Spec, now: string): string {
  return spec.at <= now ? "completed" : "unstarted";
}

/** An event as `getCompletedEvents` sends it: no type, no state. */
function completedEvent(spec: Spec, now: string): object {
  return {
    startTime: spec.at,
    blockName: spec.block,
    match: { id: spec.id, teams: teams(spec, now), strategy: { type: "bestOf", count: spec.bestOf } },
  };
}

function event(spec: Spec, now: string): object {
  return { ...completedEvent(spec, now), state: state(spec, now), type: "match" };
}

function standingsMatch(spec: Spec, now: string): object {
  return { id: spec.id, state: state(spec, now), teams: teams(spec, now) };
}

// Worlds 2026: 2025's Swiss results replayed on 2026's days, round by round
// and best record first within a round, which is how the API lists them.
const SWISS_RESULTS: [string, string, Score][] = [
  ["VKS", "TSW", [0, 1]], ["FNC", "CFO", [0, 1]], ["MKOI", "KT", [0, 1]], ["100T", "BLG", [1, 0]],
  ["T1", "FLY", [1, 0]], ["AL", "HLE", [1, 0]], ["TES", "G2", [1, 0]], ["PSG", "GEN", [0, 1]],
  ["TSW", "KT", [0, 1]], ["100T", "TES", [0, 1]], ["T1", "CFO", [0, 1]], ["AL", "GEN", [1, 0]],
  ["FLY", "VKS", [1, 0]], ["G2", "MKOI", [1, 0]], ["FNC", "BLG", [0, 1]], ["PSG", "HLE", [0, 1]],
  ["TES", "KT", [0, 2]], ["AL", "CFO", [2, 1]], ["TSW", "FLY", [0, 1]], ["T1", "GEN", [0, 1]],
  ["G2", "BLG", [1, 0]], ["100T", "HLE", [0, 1]], ["FNC", "MKOI", [1, 2]], ["VKS", "PSG", [2, 1]],
  ["HLE", "CFO", [2, 0]], ["G2", "FLY", [2, 1]], ["TES", "GEN", [0, 2]], ["TSW", "MKOI", [1, 2]],
  ["VKS", "BLG", [0, 2]], ["T1", "100T", [2, 0]],
  ["FLY", "CFO", [0, 2]], ["BLG", "TES", [1, 2]], ["T1", "MKOI", [2, 0]],
];

/** Each Swiss round's first day; its matches run four a day from noon UTC. */
const SWISS_ROUNDS = [
  { from: 0, day: "2026-10-23" },
  { from: 8, day: "2026-10-25" },
  { from: 16, day: "2026-10-27" },
  { from: 24, day: "2026-10-29" },
  { from: 30, day: "2026-10-31" },
];

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const SWISS: Spec[] = SWISS_RESULTS.map(([home, away, score], i) => {
  const round = SWISS_ROUNDS.findLastIndex((r) => r.from <= i);
  const { from, day } = SWISS_ROUNDS[round];
  const n = i - from;
  const at = `${addDays(day, Math.floor(n / 4))}T${String(12 + (n % 4)).padStart(2, "0")}:00:00Z`;
  // Each round is drawn once the one before it has been played.
  const previous = SWISS_ROUNDS[round - 1];
  const drawn = previous ? `${addDays(day, -1)}T23:00:00Z` : undefined;
  const bestOf = score[0] + score[1] > 1 ? 3 : 1;
  return { id: `swiss-${i + 1}`, at, block: "Swiss", home, away, score, bestOf, drawn };
});

/** Each knockout is drawn once the round before it has been played. */
const KNOCKOUTS: Spec[] = (
  [
    ["qf1", "2026-11-03T19:00:00Z", "Quarterfinals", "KT", "TES", [3, 1], "2026-11-01"],
    ["qf2", "2026-11-04T19:00:00Z", "Quarterfinals", "AL", "T1", [2, 3], "2026-11-01"],
    ["qf3", "2026-11-05T19:00:00Z", "Quarterfinals", "HLE", "CFO", [3, 0], "2026-11-01"],
    ["qf4", "2026-11-06T19:00:00Z", "Quarterfinals", "G2", "GEN", [1, 3], "2026-11-01"],
    ["sf1", "2026-11-07T22:00:00Z", "Semifinals", "KT", "T1", [1, 3], "2026-11-07"],
    ["sf2", "2026-11-08T22:00:00Z", "Semifinals", "HLE", "GEN", [2, 3], "2026-11-07"],
    ["final", "2026-11-14T19:00:00Z", "Finals", "T1", "GEN", [3, 2], "2026-11-09"],
  ] as const
).map(([id, at, block, home, away, score, drawn]) => ({
  id: `worlds-${id}`,
  at,
  block,
  home,
  away,
  score: [...score] as Score,
  bestOf: 5,
  drawn,
}));

type Regional = {
  tournament: Tournament;
  /** The stage slug and section name the league files its playoff under. */
  playoffStage: [slug: string, section: string];
  ranking: [code: string, wins: number, losses: number][];
  playoffs: Spec[];
  /** A stage after the final (LPL's Regional Qualifier). */
  after?: { stage: [slug: string, section: string]; matches: Spec[] };
};

const final = (
  league: string,
  at: string,
  block: string,
  home: string,
  away: string,
  score: Score,
): Spec => ({ id: `${league}-${block.toLowerCase().replace(/ /g, "-")}-${at.slice(5, 10)}`, at, block, home, away, score, bestOf: 5 });

const REGIONALS_2026: Record<string, Regional> = {
  lec: {
    tournament: { id: "lec_split_3_2026", slug: "lec_split_3_2026", startDate: "2026-07-23", endDate: "2026-09-20" },
    playoffStage: ["playoffs", "Playoffs"],
    ranking: [["KC", 9, 0], ["G2", 7, 2]],
    playoffs: [
      final("lec", "2026-09-19T15:00:00Z", "Playoffs", "KC", "MKOI", [0, 3]),
      final("lec", "2026-09-20T15:00:00Z", "Finals", "G2", "MKOI", [3, 0]),
    ],
  },
  lcs: {
    tournament: { id: "lcs_split_3_2026", slug: "lcs_split_3_2026", startDate: "2026-07-25", endDate: "2026-10-05" },
    playoffStage: ["playoffs", "Playoffs"],
    ranking: [["TLAW", 6, 1], ["LYON", 5, 2]],
    playoffs: [
      final("lcs", "2026-10-03T20:00:00Z", "Playoffs", "LYON", "C9", [3, 1]),
      final("lcs", "2026-10-04T20:00:00Z", "Finals", "TLAW", "LYON", [3, 1]),
    ],
  },
  lck: {
    tournament: { id: "lck_split_3_2026", slug: "lck_split_3_2026", startDate: "2026-07-28", endDate: "2026-09-13" },
    playoffStage: ["regional_championship", "Regional Championship"],
    ranking: [["GEN", 16, 2], ["HLE", 14, 4]],
    playoffs: [
      final("lck", "2026-09-12T05:00:00Z", "Playoffs", "HLE", "T1", [3, 1]),
      final("lck", "2026-09-13T05:00:00Z", "Finals", "GEN", "HLE", [3, 1]),
    ],
  },
  lpl: {
    tournament: { id: "lpl_split_3_2026", slug: "lpl_split_3_2026", startDate: "2026-07-21", endDate: "2026-09-19" },
    playoffStage: ["playoffs", "Playoffs"],
    ranking: [["BLG", 13, 1], ["AL", 12, 2]],
    playoffs: [
      final("lpl", "2026-09-12T09:00:00Z", "Playoffs", "IG", "AL", [2, 3]),
      final("lpl", "2026-09-13T09:00:00Z", "Finals", "AL", "BLG", [3, 1]),
    ],
    // Played after the final: its winner is not the champion.
    after: {
      stage: ["regional_qualifier", "Regional Qualifier"],
      matches: [final("lpl", "2026-09-19T09:00:00Z", "Regional Qualifier", "JDG", "IG", [1, 3])],
    },
  },
};

/** 2027's first splits, listed from the new year. */
const NEXT_SEASON: Record<string, { tournament: Tournament; matches: Spec[]; ranking?: [string, number, number][] }> = {
  lck: {
    tournament: { id: "lck_split_1_2027", slug: "lck_split_1_2027", startDate: "2027-01-13", endDate: "2027-03-01" },
    matches: [
      { id: "lck27-1", at: "2027-01-13T08:00:00Z", block: "Week 1", home: "DK", away: "KT", score: [2, 1], bestOf: 3 },
      { id: "lck27-2", at: "2027-01-14T08:00:00Z", block: "Week 1", home: "T1", away: "GEN", score: [2, 0], bestOf: 3 },
      { id: "lck27-3", at: "2027-01-15T08:00:00Z", block: "Week 1", home: "HLE", away: "BFX", score: [2, 0], bestOf: 3 },
    ],
    ranking: [["DK", 1, 0], ["KT", 0, 1]],
  },
  lpl: {
    tournament: { id: "lpl_split_1_2027", slug: "lpl_split_1_2027", startDate: "2027-01-13", endDate: "2027-03-08" },
    matches: [
      { id: "lpl27-1", at: "2027-01-13T09:00:00Z", block: "Week 1", home: "AL", away: "WE", score: [2, 0], bestOf: 3 },
      { id: "lpl27-2", at: "2027-01-14T11:00:00Z", block: "Week 1", home: "BLG", away: "JDG", score: [2, 1], bestOf: 3 },
    ],
  },
  lec: {
    tournament: { id: "lec_split_1_2027", slug: "lec_split_1_2027", startDate: "2027-01-16", endDate: "2027-03-01" },
    matches: [
      { id: "lec27-1", at: "2027-01-16T17:00:00Z", block: "Week 1", home: "G2", away: "FNC", score: [1, 0], bestOf: 1 },
    ],
  },
  lcs: {
    tournament: { id: "lcs_split_1_2027", slug: "lcs_split_1_2027", startDate: "2027-01-24", endDate: "2027-03-02" },
    matches: [
      { id: "lcs27-1", at: "2027-01-24T21:00:00Z", block: "Week 1", home: "TLAW", away: "C9", score: [1, 0], bestOf: 1 },
    ],
  },
};

const WORLDS_2025: Tournament = { id: "worlds_2025", slug: "worlds_2025", startDate: "2025-10-14", endDate: "2025-11-09" };
const WORLDS_2026: Tournament = { id: "worlds_2026", slug: "worlds_2026", startDate: "2026-10-15", endDate: "2026-11-15" };

function tournamentsFor(league: string, now: string): Tournament[] {
  const nextSeason = now >= "2027-01-01" && NEXT_SEASON[league] ? [NEXT_SEASON[league].tournament] : [];
  switch (league) {
    case "worlds":
      return [WORLDS_2026, WORLDS_2025];
    case "msi":
      return [{ id: "msi_2026", slug: "msi_2026", startDate: "2026-06-27", endDate: "2026-07-12" }];
    case "first_stand":
      return [{ id: "first_stand_2026", slug: "first_stand_2026", startDate: "2026-03-16", endDate: "2026-03-23" }];
    default:
      return [...nextSeason, REGIONALS_2026[league].tournament];
  }
}

const ranked = (rows: [string, number, number][]): object[] =>
  rows.map(([code, wins, losses], i) => ({
    ordinal: i + 1,
    teams: [{ name: NAMES[code] ?? code, code, image: logo(code), record: { wins, losses } }],
  }));

function standingsFor(tournamentId: string, now: string): object | null {
  if (tournamentId === WORLDS_2026.id) {
    return {
      stages: [
        { slug: "swiss", name: "Swiss", sections: [{ name: "Swiss", rankings: [], matches: SWISS.map((s) => standingsMatch(s, now)) }] },
        {
          slug: "knockouts",
          name: "Knockouts",
          sections: [{ name: "Knockouts", rankings: [], matches: KNOCKOUTS.map((s) => standingsMatch(s, now)) }],
        },
      ],
    };
  }
  const regional = Object.values(REGIONALS_2026).find((r) => r.tournament.id === tournamentId);
  if (regional) {
    const [slug, section] = regional.playoffStage;
    return {
      stages: [
        { slug: "regular_season", name: "Regular Season", sections: [{ name: "Regular Season", rankings: ranked(regional.ranking) }] },
        { slug, name: section, sections: [{ name: section, rankings: [], matches: regional.playoffs.map((s) => standingsMatch(s, now)) }] },
        ...(regional.after
          ? [
              {
                slug: regional.after.stage[0],
                name: regional.after.stage[1],
                sections: [
                  { name: regional.after.stage[1], rankings: [], matches: regional.after.matches.map((s) => standingsMatch(s, now)) },
                ],
              },
            ]
          : []),
      ],
    };
  }
  const next = Object.values(NEXT_SEASON).find((n) => n.tournament.id === tournamentId);
  if (next?.ranking) {
    return { stages: [{ slug: "groups", name: "Groups", sections: [{ name: "Groups", rankings: ranked(next.ranking) }] }] };
  }
  return null;
}

/**
 * A league's schedule, newest page first. Once 2027 is listed, the newest page
 * holds only 2027's matches and 2026's sit on the page before it.
 */
function schedulePages(league: string, now: string): Spec[][] {
  if (league === "worlds") return [[...SWISS, ...KNOCKOUTS]];
  const regional = REGIONALS_2026[league];
  if (!regional) return [[]];
  const season2026 = [...regional.playoffs, ...(regional.after?.matches ?? [])];
  const next = NEXT_SEASON[league];
  return now >= "2027-01-01" && next ? [next.matches, season2026] : [season2026];
}

/** A tournament's matches, for its completed events. */
function tournamentMatches(tournamentId: string): Spec[] {
  if (tournamentId === WORLDS_2026.id) return [...SWISS, ...KNOCKOUTS];
  const regional = Object.values(REGIONALS_2026).find((r) => r.tournament.id === tournamentId);
  if (regional) return [...regional.playoffs, ...(regional.after?.matches ?? [])];
  return Object.values(NEXT_SEASON).find((n) => n.tournament.id === tournamentId)?.matches ?? [];
}

export type FakeLolesportsOptions = {
  /** Every request for an older schedule page fails. */
  olderPagesFail?: boolean;
  /** Every request for a tournament's completed events fails. */
  completedEventsFail?: boolean;
};

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

/** A `fetch` that answers like Lolesports would at `now` (an ISO instant). */
export function fakeLolesports(
  now: string,
  options: FakeLolesportsOptions = {},
): (input: string | URL | Request) => Promise<Response> {
  return async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const leagueId = url.searchParams.get("leagueId") ?? "";
    if (url.pathname.endsWith("/getLeagues")) {
      return json({ data: { leagues: LEAGUES } });
    }
    if (url.pathname.endsWith("/getTournamentsForLeague")) {
      return json({ data: { leagues: [{ tournaments: tournamentsFor(leagueId, now) }] } });
    }
    if (url.pathname.endsWith("/getStandings")) {
      const standings = standingsFor(url.searchParams.get("tournamentId") ?? "", now);
      return standings ? json({ data: { standings: [standings] } }) : new Response("{}", { status: 404 });
    }
    if (url.pathname.endsWith("/getCompletedEvents")) {
      if (options.completedEventsFail) return new Response("{}", { status: 500 });
      const events = tournamentMatches(url.searchParams.get("tournamentId") ?? "")
        .filter((s) => s.at <= now)
        .sort((a, b) => a.at.localeCompare(b.at))
        .map((s) => completedEvent(s, now));
      return json({ data: { schedule: { events } } });
    }
    if (url.pathname.endsWith("/getSchedule")) {
      const pages = schedulePages(leagueId, now);
      const token = url.searchParams.get("pageToken");
      if (token && options.olderPagesFail) return new Response("{}", { status: 500 });
      const index = token ? Number(token.replace("older-", "")) : 0;
      const page = pages[index] ?? [];
      return json({
        data: {
          schedule: {
            pages: { older: index + 1 < pages.length ? `older-${index + 1}` : null, newer: null },
            events: [...page].sort((a, b) => a.at.localeCompare(b.at)).map((s) => event(s, now)),
          },
        },
      });
    }
    return new Response("{}", { status: 404 });
  };
}
