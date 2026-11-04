/**
 * The national channels of a game, as ESPN names them: TV first, then
 * streaming ("NBC", "Peacock"). Only national ones — a team's regional
 * network is on in one city, and League Pass carries nearly every game, so
 * neither says where to watch. These are the US's; abroad they differ.
 */

type HeaderEvent = {
  /** The national channels in one string: "Peacock/NBC", "" for none. */
  broadcast?: string | null;
  /** Every channel, national or not, each with its kind: "TV", "Streaming". */
  broadcasts?: Array<{ name?: string; type?: string }>;
};

type SiteCompetition = {
  broadcasts?: Array<{ market?: string; names?: string[] }>;
  geoBroadcasts?: Array<{ media?: { shortName?: string }; type?: { shortName?: string } }>;
};

/** TV before streaming, each kept in ESPN's order. */
function tvFirst(names: string[], streaming: Set<string>): string[] {
  const unique = [...new Set(names)];
  return [...unique.filter((n) => !streaming.has(n)), ...unique.filter((n) => streaming.has(n))];
}

/** From an event of espn.com's scores bar (`/apis/v2/scoreboard/header`). */
export function headerBroadcasts(event: HeaderEvent): string[] {
  const names = (event.broadcast ?? "")
    .split("/")
    .map((n) => n.trim())
    .filter(Boolean);
  const streaming = new Set(
    (event.broadcasts ?? []).flatMap((b) => (b.type === "Streaming" && b.name ? [b.name] : []))
  );
  return tvFirst(names, streaming);
}

/** From a competition of the site API's `/scoreboard`. */
export function siteBroadcasts(competition: SiteCompetition | undefined): string[] {
  const names = (competition?.broadcasts ?? [])
    .filter((b) => b.market === "national")
    .flatMap((b) => b.names ?? [])
    .map((n) => n.trim())
    .filter(Boolean);
  const streaming = new Set(
    (competition?.geoBroadcasts ?? []).flatMap((b) =>
      b.type?.shortName === "Streaming" && b.media?.shortName ? [b.media.shortName] : []
    )
  );
  return tvFirst(names, streaming);
}
