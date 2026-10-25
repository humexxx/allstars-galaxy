import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { SurfDraw } from "@/types/sports";

import { decodeEntities, parseDateRange, parseDraw, parseRankings, parseSchedule, winnerOf } from "./wsl-parse";

// Trimmed from the WSL's own pages as saved on 2026-10-25: the schedule's
// rows, Portugal's Round 1 heat 1 and Final (?showAll=1), the Philippines
// Pro's first heat before the draw was made, and four ranking rows.
const fixture = (name: string): string => readFileSync(join(__dirname, "__fixtures__", name), "utf8");
const SCHEDULE = fixture("wsl-schedule.html");
const PORTUGAL = fixture("wsl-draw-portugal.html");
const PHILIPPINES = fixture("wsl-draw-philippines.html");
const RANKINGS = fixture("wsl-rankings.html");

/** The site's "Postseason Qualification Line" row, between two athletes' rows as on the saved page. */
const CUT_OFF_ROW = `<tr class="insertedathlete-3122 mid-cut-off-row">
  <td colspan="17"><div class="cut-off-line"><div class="cut-off-text"><span>Postseason Qualification Line</span></div></div></td>
</tr>`;

describe("decodeEntities", () => {
  it("reads named, numeric and accented-letter entities", () => {
    expect(decodeEntities("O&apos;Leary &amp; O&#039;Brien")).toBe("O'Leary & O'Brien");
    expect(decodeEntities("&ndash;&ndash; &#x2013;")).toBe("–– –");
    expect(decodeEntities("Jo&atilde;o Chian&ccedil;a, Teahupo&#699;o")).toBe("João Chiança, Teahupoʻo");
  });

  it("leaves what it does not know as it is", () => {
    expect(decodeEntities("&bogus; & plain")).toBe("&bogus; & plain");
  });
});

describe("parseDateRange", () => {
  it("dates a range within one month, across two, and a single day", () => {
    expect(parseDateRange("Oct 16 - 25", 2026)).toEqual({ startDate: "2026-10-16", endDate: "2026-10-25" });
    expect(parseDateRange("Sep 28 - Oct 7", 2026)).toEqual({ startDate: "2026-09-28", endDate: "2026-10-07" });
    expect(parseDateRange("Apr 1", 2026)).toEqual({ startDate: "2026-04-01", endDate: "2026-04-01" });
  });

  it("ends a waiting period that runs into January in the next year", () => {
    expect(parseDateRange("Dec 28 - Jan 4", 2026)).toEqual({ startDate: "2026-12-28", endDate: "2027-01-04" });
  });

  it("is nothing for text that is not a range", () => {
    expect(parseDateRange("TBD", 2026)).toBeNull();
  });
});

describe("parseSchedule", () => {
  const events = parseSchedule(SCHEDULE, 2026);

  it("reads every stop, and none of the month rows between them", () => {
    expect(events.map((e) => e.id)).toEqual(["436", "441", "442", "445", "543"]);
  });

  it("names a stop without its sponsor, and keeps its place, dates and number", () => {
    expect(events[0]).toEqual({
      id: "436",
      slug: "rip-curl-pro-bells-beach",
      name: "Rip Curl Pro Bells Beach",
      location: "Bells Beach, Victoria, Australia",
      startDate: "2026-04-01",
      endDate: "2026-04-11",
      status: "completed",
      stop: 1,
      statEventId: "5094",
    });
    expect(events.find((e) => e.id === "441")!.location).toBe("Teahupoʻo, Tahiti, French Polynesia");
  });

  it("dates a waiting period across two months", () => {
    const fiji = events.find((e) => e.slug === "fiji-pro")!;
    expect([fiji.startDate, fiji.endDate, fiji.stop]).toEqual(["2026-08-25", "2026-09-04", 8]);
    const philippines = events.find((e) => e.slug === "philippines-pro")!;
    expect([philippines.startDate, philippines.endDate]).toEqual(["2026-10-31", "2026-11-10"]);
  });

  it("reads over as completed, upcoming as upcoming, and any other state as live", () => {
    expect(events.map((e) => e.status)).toEqual(["completed", "completed", "completed", "completed", "upcoming"]);
    const onNow = parseSchedule(SCHEDULE.replace("event-status--upcoming", "event-status--standby"), 2026);
    expect(onNow.find((e) => e.id === "543")!.status).toBe("live");
  });

  it("leaves a cancelled stop out", () => {
    const cancelled = parseSchedule(SCHEDULE.replace("event-status--upcoming", "event-status--canceled"), 2026);
    expect(cancelled.map((e) => e.id)).not.toContain("543");
  });

  it("is empty for a page with no schedule", () => {
    expect(parseSchedule("<html><body>Maintenance</body></html>", 2026)).toEqual([]);
  });

  it("keeps each stop's men's stat event id", () => {
    expect(events.map((e) => e.statEventId)).toEqual(["5094", "5106", "5108", "5114", "5295"]);
  });

  it("reads another season's stops as none, rather than dating them in this one", () => {
    expect(parseSchedule(SCHEDULE, 2027)).toEqual([]);
  });

  it("reads the status out of the cell's classes, whatever else they hold", () => {
    const extra = parseSchedule(
      SCHEDULE.replace("event-status event-status--upcoming", "event-status is-new event-status--upcoming"),
      2026
    );
    expect(extra.find((e) => e.id === "543")!.status).toBe("upcoming");
  });

  it("throws on a stop whose status it cannot read, rather than calling it upcoming", () => {
    expect(() => parseSchedule(SCHEDULE.replace("event-status--upcoming", "event-state--upcoming"), 2026)).toThrow(
      "no status read for event 543"
    );
  });
});

describe("parseDraw", () => {
  const draw = parseDraw(PORTUGAL, "445");

  it("keeps the rounds in the page's order, under their own names", () => {
    expect(draw.eventId).toBe("445");
    expect(draw.rounds.map((r) => r.label)).toEqual(["Round 1", "Final"]);
  });

  it("reads each heat's number, state and surfers, their totals, places and faces", () => {
    expect(draw.rounds[0].heats[0]).toEqual({
      id: "114284",
      number: 1,
      status: "completed",
      surfers: [
        {
          athleteId: "9654",
          name: "Callum Robson",
          imageUrl: expect.stringContaining("811b6f37b358f0c64b143ca693d9fc22.png?&x=192&y=192"),
          score: 10.66,
          place: 2,
        },
        {
          athleteId: "2838",
          name: "Connor O'Leary",
          imageUrl: expect.stringContaining("a2c413dc94cf9e1d417cdde39dcbd73e.png?&x=192&y=192"),
          score: 11.33,
          place: 1,
        },
      ],
    });
  });

  it("falls back to the heat's own headshot without the embedded athletes", () => {
    const bare = parseDraw(PORTUGAL.replace(/<script>[\s\S]*<\/script>/, ""), "445");
    expect(bare.rounds[0].heats[0].surfers[0].imageUrl).toContain("x=250&y=250");
  });

  it("keeps a seed's place as the surfer's name before the draw is made", () => {
    const upcoming = parseDraw(PHILIPPINES, "543");
    // Saved as the round-at-a-time page (/results, not the ?showAll=1 the
    // service asks for), which heads its grid with nothing: this covers that
    // layout as a fallback, the round strip naming the round.
    expect(upcoming.rounds.map((r) => r.label)).toEqual(["Round 1"]);
    expect(upcoming.rounds[0].heats[0]).toEqual({
      id: "114307",
      number: 1,
      status: "upcoming",
      surfers: [
        { name: "Event seed #16", score: null },
        { name: "Event seed #17", score: null },
      ],
    });
  });

  it("reads a heat in the water as live", () => {
    const live = parseDraw(PORTUGAL.replaceAll("heat-status-over", "heat-status-live"), "445");
    expect(live.rounds[0].heats[0].status).toBe("live");
  });

  it("throws on a heat whose state it cannot read, rather than calling it upcoming", () => {
    const unread = PORTUGAL.replaceAll("heat-status-over", "heat-state-over").replaceAll(
      "heat-grid__heat--status-over",
      "heat-grid__heat--state-over"
    );
    expect(() => parseDraw(unread, "445")).toThrow("no status read for heat 114284");
  });

  it("is a draw with no rounds for a page with no heats", () => {
    expect(parseDraw("<html></html>", "445")).toEqual({ eventId: "445", rounds: [] });
  });
});

describe("winnerOf", () => {
  it("names the Final's winner and runner-up", () => {
    expect(winnerOf(parseDraw(PORTUGAL, "445"))).toEqual({ winner: "Griffin Colapinto", runnerUp: "Gabriel Medina" });
  });

  it("is nothing until the Final has been surfed", () => {
    const final = (status: SurfDraw["rounds"][number]["heats"][number]["status"]): SurfDraw => ({
      eventId: "1",
      rounds: [
        {
          label: "Final",
          heats: [
            {
              id: "f",
              number: 1,
              status,
              surfers: [
                { athleteId: "1", name: "A", score: 15, place: 1 },
                { athleteId: "2", name: "B", score: 12, place: 2 },
              ],
            },
          ],
        },
      ],
    });
    expect(winnerOf(final("live"))).toBeNull();
    expect(winnerOf(final("completed"))).toEqual({ winner: "A", runnerUp: "B" });
    expect(winnerOf(parseDraw(PHILIPPINES, "543"))).toBeNull();
    expect(winnerOf({ eventId: "1", rounds: [] })).toBeNull();
  });
});

describe("parseRankings", () => {
  const page = RANKINGS.replace(/(<\/tr>\s*)(<tr\s+class="athlete-)/, `$1${CUT_OFF_ROW}$2`);
  const rankings = parseRankings(page);

  it("reads each athlete's row, and no row between them", () => {
    expect(page).toContain("mid-cut-off-row");
    expect(rankings).toHaveLength(4);
  });

  it("reads each row's rank, surfer, country, flag, face and points", () => {
    expect(rankings).toHaveLength(4);
    expect(rankings[0]).toEqual({
      position: 1,
      athleteId: "3994",
      name: "Yago Dora",
      country: "Brazil",
      flagUrl: expect.stringContaining("9b4d7994a40d31f09a275058d9c4a6ad.png"),
      imageUrl: expect.stringContaining("bd508dcf37016d40162636362720ab38.png?&x=48&y=48"),
      points: 48865,
    });
    expect(rankings.map((r) => [r.position, r.name, r.points])).toEqual([
      [1, "Yago Dora", 48865],
      [2, "Italo Ferreira", 46015],
      [3, "Griffin Colapinto", 43695],
      [13, "Liam O'Brien", 27005],
    ]);
  });

  it("is empty for a page with no ranking", () => {
    expect(parseRankings("<table></table>")).toEqual([]);
  });
});
