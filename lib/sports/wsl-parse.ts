import type { SurfDraw, SurfEvent, SurfFinal, SurfHeat, SurfRanking, SurfRound, SurfStatus, SurfSurfer } from "@/types/sports";

/**
 * Readers for the World Surf League's own pages: the season's schedule, an
 * event's results (its whole draw, `?showAll=1`) and the men's rankings.
 *
 * The site is server-rendered PHP with stable BEM class names (`hot-heat`,
 * `event-schedule-details__*`, `athlete-*`), so a few focused patterns over
 * those classes read it without an HTML parser at runtime. Everything here is
 * pure: the service fetches, these only read.
 */

// ---------- Text ----------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  szlig: "ß",
  oslash: "ø",
  Oslash: "Ø",
  aelig: "æ",
  AElig: "Æ",
};

/** The diacritic each accented-letter entity puts on its letter: `&eacute;` is e + ◌́. */
const COMBINING: Record<string, string> = {
  acute: "́",
  grave: "̀",
  circ: "̂",
  tilde: "̃",
  uml: "̈",
  ring: "̊",
  cedil: "̧",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    const named = NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()];
    if (named) return named;
    const accented = /^([a-z])(acute|grave|circ|tilde|uml|ring|cedil)$/i.exec(body);
    return accented ? `${accented[1]}${COMBINING[accented[2].toLowerCase()]}`.normalize("NFC") : whole;
  });
}

/** An element's words: tags dropped, entities decoded, spaces collapsed. */
function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function attrOf(tag: string, name: string): string | undefined {
  const value = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
  return value === undefined ? undefined : decodeEntities(value);
}

/** The words inside the first element carrying `className`, up to its closing tag. */
function textIn(html: string, className: string, closing = "div"): string | undefined {
  const pattern = new RegExp(`class="(?:[^"]*\\s)?${className}(?:\\s[^"]*)?"[^>]*>([\\s\\S]*?)</${closing}>`);
  const inner = pattern.exec(html)?.[1];
  if (inner === undefined) return undefined;
  const text = textOf(inner);
  return text || undefined;
}

/** WSL's stand-in headshot for a surfer with no photo, or a seed not drawn yet. */
function isPlaceholderImage(url: string): boolean {
  return /headshot-default/i.test(url);
}

function imageOf(tag: string | undefined): string | undefined {
  const url = tag ? attrOf(tag, "data-img-src") : undefined;
  return url && !isPlaceholderImage(url) ? url : undefined;
}

/** The pieces of `html` between successive matches of `start`, each with its match. */
function sections(html: string, start: RegExp): Array<{ match: RegExpExecArray; body: string }> {
  const found = [...html.matchAll(new RegExp(start.source, `${start.flags.replace("g", "")}g`))];
  return found.map((match, i) => ({
    match,
    body: html.slice(match.index + match[0].length, found[i + 1]?.index ?? html.length),
  }));
}

// ---------- Schedule ----------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function day(year: number, month: number, date: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

/**
 * "Oct 16 - 25" or, across a month, "Aug 25 - Sep 4", as calendar days of
 * `year` — the page prints no year. A waiting period that runs into January
 * ends in the next one.
 */
export function parseDateRange(text: string, year: number): { startDate: string; endDate: string } | null {
  const match = /^([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:\s*[-–]\s*(?:([a-z]{3})[a-z]*\.?\s+)?(\d{1,2}))?$/i.exec(
    text.trim()
  );
  if (!match) return null;
  const startMonth = MONTHS.indexOf(match[1].toLowerCase());
  const endMonth = match[3] ? MONTHS.indexOf(match[3].toLowerCase()) : startMonth;
  if (startMonth < 0 || endMonth < 0) return null;
  const startDay = Number(match[2]);
  const endDay = match[4] ? Number(match[4]) : startDay;
  return {
    startDate: day(year, startMonth, startDay),
    endDate: day(endMonth < startMonth ? year + 1 : year, endMonth, endDay),
  };
}

/**
 * `event-status--over` and `--upcoming`; every other state the site styles
 * (`--live`, `--on`, `--standby` on a lay day) is an event under way.
 */
function eventStatus(modifier: string): SurfStatus | "canceled" {
  if (modifier === "over") return "completed";
  if (modifier === "upcoming") return "upcoming";
  if (/^cancel/.test(modifier)) return "canceled";
  return "live";
}

/**
 * A stop as the service needs it: with the men's stat event id from its row,
 * which picks the men's draw off the joint event's results page.
 */
export type WslEvent = SurfEvent & { statEventId?: string };

/**
 * The Championship Tour's stops, `tr.event-{statEventId}`, in date order.
 *
 * A row linking another season's stop is left out, so a page served for the
 * wrong year reads as empty rather than mis-dated. A cancelled stop is left
 * out too: the tour's status has no word for it, and listed as live or
 * upcoming it would be featured.
 *
 * Throws on a stop whose status cannot be read: defaulting it would turn the
 * whole season "upcoming" on a renamed class, and the cache would keep that.
 */
export function parseSchedule(html: string, year: number): WslEvent[] {
  const events: WslEvent[] = [];
  for (const row of html.matchAll(/<tr\s+class="event-(\d+)(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const [, statEventId, cells] = row;
    const anchor = /<a\s[^>]*class="event-schedule-details__event-name"[^>]*>([\s\S]*?)<\/a>/.exec(cells);
    const link = anchor && /\/events\/(\d{4})\/ct\/(\d+)\/([^/?#"]+)/.exec(anchor[0]);
    const dateText = /class="event-date-range[^"]*"[^>]*>([\s\S]*?)<\/td>/.exec(cells)?.[1];
    const dates = dateText ? parseDateRange(textOf(dateText), year) : null;
    if (!anchor || !link || Number(link[1]) !== year || !dates) continue;
    const modifier = /\bevent-status--([a-z-]+)/.exec(cells)?.[1];
    if (!modifier) throw new Error(`wsl: no status read for event ${link[2]}`);
    const status = eventStatus(modifier);
    if (status === "canceled") continue;

    const name = textOf(anchor[1].split(/<span[^>]*event-schedule-details__sponsor/)[0])
      .replace(/\s+Presented By\b.*$/i, "")
      .trim();
    const stop = Number(/Event\s+(\d+)/.exec(textIn(cells, "event-tour-details__secondary") ?? "")?.[1]);
    events.push({
      id: link[2],
      slug: link[3],
      name,
      location: textIn(cells, "event-schedule-details__location", "span") ?? "",
      ...dates,
      status,
      stop: Number.isFinite(stop) && stop > 0 ? stop : events.length + 1,
      statEventId,
    });
  }
  return events.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.stop - b.stop);
}

// ---------- Draw ----------

function heatStatus(modifier: string): SurfStatus {
  if (modifier === "over") return "completed";
  if (modifier === "upcoming") return "upcoming";
  return "live";
}

/** The 192px headshots the results page embeds for its athletes, by athlete id. */
function embeddedImages(html: string): Map<string, string> {
  const images = new Map<string, string>();
  for (const list of html.matchAll(/"athletes":(\[[^\]]*\])/g)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(list[1]);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    for (const entry of parsed as unknown[]) {
      if (typeof entry !== "object" || entry === null) continue;
      const { id, imageUrl } = entry as { id?: unknown; imageUrl?: unknown };
      if (typeof id === "string" && typeof imageUrl === "string" && !isPlaceholderImage(imageUrl)) {
        images.set(id, imageUrl);
      }
    }
  }
  return images;
}

/**
 * Each round's name from the round strip, by round id. A page that shows one
 * round at a time heads its grid with nothing, and the strip calls the rounds
 * after the first "Bracket"; its tracking data names each one properly.
 */
function navRoundNames(html: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const tag of html.matchAll(/<a\s[^>]*[?&]roundId=(\d+)[^>]*>/g)) {
    const gtm = attrOf(tag[0], "data-gtm-event");
    const name = gtm && /"round_names":"([^"]+)"/.exec(gtm)?.[1];
    if (name && !names.has(tag[1])) names.set(tag[1], name);
  }
  return names;
}

function parseScore(text: string | undefined): number | null {
  const value = text?.trim();
  return value && /^\d+(\.\d+)?$/.test(value) ? Number(value) : null;
}

function parseSurfer(tag: string, body: string, images: Map<string, string>): SurfSurfer {
  const classes = attrOf(tag, "class") ?? "";
  const athleteId = attrOf(tag, "data-athlete-id") ?? /athlete-id-(\d+)\b/.exec(classes)?.[1];
  const place = Number(/athlete-place-(\d+)\b/.exec(classes)?.[1]);
  const name = textIn(body, "hot-heat-athlete__name--full") ?? textIn(body, "hot-heat-athlete__name--short") ?? "TBD";
  const imageUrl = (athleteId && images.get(athleteId)) || imageOf(/<[^>]*class="headshot[^"]*"[^>]*>/.exec(body)?.[0]);
  return {
    ...(athleteId ? { athleteId } : {}),
    name,
    ...(imageUrl ? { imageUrl } : {}),
    score: parseScore(textIn(body, "hot-heat-athlete__score")),
    ...(place > 0 ? { place } : {}),
  };
}

type ParsedHeat = SurfHeat & { roundNumber: number; at: number };

function parseHeat(tag: string, body: string, at: number, images: Map<string, string>): ParsedHeat {
  const inner = body.split("hot-heat__waves-details")[0];
  const status =
    /hot-heat--heat-status-([a-z-]+)/.exec(inner)?.[1] ??
    /post-event-watch-heat-grid__heat--status-([a-z-]+)/.exec(tag)?.[1];
  const id = attrOf(tag, "data-heat-id") ?? `heat-${at}`;
  if (!status) throw new Error(`wsl: no status read for heat ${id}`);
  const number = Number(attrOf(tag, "data-heat-number") ?? /heat-name">\s*Heat\s+(\d+)/.exec(inner)?.[1]);
  const surfers = sections(inner, /<div\s+class="hot-heat-athlete\s[^"]*"[^>]*>/).map(({ match, body: surfer }) =>
    parseSurfer(match[0], surfer, images)
  );
  return {
    id,
    number: Number.isFinite(number) && number > 0 ? number : 1,
    status: heatStatus(status),
    surfers,
    roundNumber: Number(attrOf(tag, "data-round-number")) || 0,
    at,
  };
}

/**
 * An event's men's draw off its results page: every round in the page's order
 * (Round 1, Round 2, Quarterfinals, Semifinals, Final), each heat with its
 * surfers, their totals and places.
 *
 * Before the draw is made a heat holds seeds ("Event seed #16"), kept as the
 * surfers' names with no athlete id. Faces come from the athletes the page
 * embeds (192px), else from the heat's own headshot. Throws on a heat whose
 * state cannot be read, as the schedule does on a stop's.
 */
export function parseDraw(html: string, eventId: string): SurfDraw {
  const images = embeddedImages(html);
  const navNames = navRoundNames(html);

  const markers = [
    ...html.matchAll(/<div\s+class="post-event-watch-heat-grid__round"\s+data-round-id="(\d+)"[^>]*>/g),
  ].map((m) => {
    const header = /^\s*<div class="post-event-watch-heat-grid__round-header">([\s\S]*?)<\/div>/.exec(
      html.slice(m.index + m[0].length)
    )?.[1];
    return { at: m.index, roundId: m[1], label: header ? textOf(header) : undefined };
  });

  const heats = sections(html, /<div\s+class="post-event-watch-heat-grid__heat\s[^"]*"[^>]*>/).map(({ match, body }) =>
    parseHeat(match[0], body, match.index, images)
  );

  const rounds: Array<SurfRound & { key: string }> = [];
  for (const heat of heats) {
    const marker = markers.filter((m) => m.at < heat.at).at(-1);
    const key = marker ? `id-${marker.roundId}` : `n-${heat.roundNumber}`;
    let round = rounds.find((r) => r.key === key);
    if (!round) {
      const label =
        marker?.label || (marker && navNames.get(marker.roundId)) || `Round ${heat.roundNumber || rounds.length + 1}`;
      round = { key, label, heats: [] };
      rounds.push(round);
    }
    const { id, number, status, surfers } = heat;
    round.heats.push({ id, number, status, surfers });
  }

  return { eventId, rounds: rounds.map(({ label, heats: list }) => ({ label, heats: list })) };
}

/** The Final's winner and runner-up, once it has been surfed. */
export function winnerOf(draw: SurfDraw): SurfFinal | null {
  const last = draw.rounds.at(-1);
  const final =
    draw.rounds.findLast((r) => /^final$/i.test(r.label.trim())) ?? (last?.heats.length === 1 ? last : undefined);
  const heat = final?.heats.at(-1);
  if (!heat || heat.status !== "completed") return null;
  const winner = heat.surfers.find((s) => s.place === 1 && s.athleteId);
  if (!winner) return null;
  const runnerUp = heat.surfers.find((s) => s.place === 2 && s.athleteId);
  return { winner: winner.name, ...(runnerUp ? { runnerUp: runnerUp.name } : {}) };
}

// ---------- Rankings ----------

/** The men's Championship Tour ranking, `tr.athlete-{id}`, in the page's order. */
export function parseRankings(html: string): SurfRanking[] {
  const rankings: SurfRanking[] = [];
  for (const row of html.matchAll(/<tr\s+class="athlete-(\d+)(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const [, athleteId, cells] = row;
    const name = textIn(cells, "athlete-name", "a");
    if (!name) continue;
    const flag = /<span[^>]*class="athlete-country-flag[^"]*"[^>]*>/.exec(cells)?.[0];
    const rank = Number(/class="athlete-rank\s[^"]*"[^>]*>\s*(\d+)/.exec(cells)?.[1]);
    const points = Number((textIn(cells, "tour-points", "span") ?? "0").replace(/[^\d.]/g, ""));
    const flagUrl = imageOf(flag);
    const imageUrl = imageOf(/<a[^>]*class="headshot[^"]*"[^>]*>/.exec(cells)?.[0]);
    rankings.push({
      position: rank > 0 ? rank : rankings.length + 1,
      athleteId,
      name,
      country: textIn(cells, "athlete-country-name", "span") ?? (flag && attrOf(flag, "title")) ?? "",
      ...(flagUrl ? { flagUrl } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      points: Number.isFinite(points) ? points : 0,
    });
  }
  return rankings;
}
