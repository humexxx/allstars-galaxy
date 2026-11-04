import { describe, expect, it } from "vitest";

import { F1_DATA } from "@/lib/data/sports/f1";
import type { F1NewsArticle, NewsStory, Team } from "@/types/sports";

import { f1Interest, fromF1Wire, leadStory, teamInterest } from "./news";

const story = (id: string, headline: string, at: string, extra: Partial<NewsStory> = {}): NewsStory => ({
  id,
  headline,
  description: null,
  href: `https://www.espn.com/${id}`,
  external: true,
  image: { url: `https://a.espncdn.com/photo/${id}.jpg` },
  at,
  kind: "story",
  about: [],
  ...extra,
});

// F1_DATA leads with round 7 and its standings with Antonelli, Russell, Leclerc.
const race = F1_DATA.races.find((r) => r.status === "upcoming")!;
const place = race.name.replace(/\s*Grand Prix$/, "");

describe("leadStory", () => {
  it("leads F1 with the latest day's story about the weekend and its leaders", () => {
    const { lead, rest } = leadStory(
      [
        story("a", "Christian Horner to Mercedes? Ex-Red Bull boss reveals approach", "2026-10-24T00:00:00Z"),
        story("b", `Leclerc quickest in practice at the ${place} Grand Prix ahead of Antonelli`, "2026-10-24T00:00:00Z"),
        story("c", "Bearman 'ready to fight for podiums'", "2026-10-24T00:00:00Z"),
      ],
      f1Interest(F1_DATA)
    );
    expect(lead?.id).toBe("b");
    expect(rest.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("will not lead with an older day's story, however apt", () => {
    const { lead } = leadStory(
      [
        story("new", "FIA president hints at V8 engine return", "2026-10-24T12:00:00Z"),
        story("old", `Antonelli wins the ${place} Grand Prix from pole`, "2026-10-22T00:00:00Z"),
      ],
      f1Interest(F1_DATA)
    );
    expect(lead?.id).toBe("new");
  });

  it("leads with a team the reader follows, by the teams a story is filed under too", () => {
    const { lead } = leadStory(
      [
        story("other", "Heat stun Pistons in Miami", "2026-10-24T03:00:00Z"),
        story("ours", "Embiid back in the lineup", "2026-10-24T02:00:00Z", { about: ["Philadelphia 76ers"] }),
      ],
      { names: ["76ers"] }
    );
    expect(lead?.id).toBe("ours");
  });

  it("never leads with a video or a recap, and prefers a picture; the wire's order on a tie", () => {
    const { lead } = leadStory(
      [
        story("clip", "Game Highlights", "2026-10-24T04:00:00Z", { kind: "video" }),
        story("recap", "Lakers past Clippers", "2026-10-24T04:00:00Z", { kind: "recap" }),
        story("bare", "Antonelli on pole", "2026-10-24T04:00:00Z", { image: null }),
        story("first", "Hamilton's advice", "2026-10-24T03:00:00Z"),
        story("second", "Slater to join Audi", "2026-10-24T03:00:00Z"),
      ],
      { names: [] }
    );
    expect(lead?.id).toBe("first");
  });

  it("never leads with betting lines or fantasy advice", () => {
    const { lead } = leadStory(
      [
        story("odds", "NFL Week 7 betting odds: Lines and totals for every game", "2026-10-24T04:00:00Z"),
        story("news", "Chiefs sign veteran receiver", "2026-10-24T03:00:00Z"),
      ],
      { names: [] }
    );
    expect(lead?.id).toBe("news");
  });

  it("has nothing to lead with on an empty wire", () => {
    expect(leadStory([], { names: [] })).toEqual({ lead: null, rest: [] });
  });
});

describe("fromF1Wire", () => {
  it("opens F1's stored stories on our own page, with their widest picture", () => {
    const item: F1NewsArticle = {
      id: "42",
      headline: "Leclerc quickest",
      description: "In first practice.",
      link: "https://www.espn.com/f1/story/_/id/1",
      images: [
        { url: "https://a.espncdn.com/small.jpg", width: 300, height: 200 },
        { url: "https://a.espncdn.com/wide.jpg", width: 1296, height: 729, alt: "Leclerc" },
      ],
      firstSeenAt: new Date("2026-10-24T00:00:34Z"),
    };
    expect(fromF1Wire([item])).toEqual([
      {
        id: "42",
        headline: "Leclerc quickest",
        description: "In first practice.",
        href: "/news/f1/42",
        external: false,
        image: { url: "https://a.espncdn.com/wide.jpg", alt: "Leclerc" },
        at: "2026-10-24T00:00:34.000Z",
        kind: "story",
        about: [],
      },
    ]);
  });
});

describe("teamInterest", () => {
  const team = (id: string, name: string, shortName: string): Team => ({ id, name, shortName, code: id.toUpperCase() });
  const teams = new Map([
    ["fcb", team("fcb", "FC Barcelona", "Barça")],
    ["rma", team("rma", "Real Madrid CF", "Real Madrid")],
    ["nap", team("nap", "SSC Napoli", "Napoli")],
  ]);

  it("names the picked teams, then the table's leaders, as a headline would", () => {
    expect(teamInterest(teams, ["nap"], ["fcb", "nap"]).names).toEqual(["Napoli", "Barça", "Barcelona"]);
  });

  it("finds a club by its name without the club's letters, accents aside", () => {
    const { lead } = leadStory(
      [
        story("other", "Girona hold Villarreal", "2026-10-24T03:00:00Z"),
        story("ours", "Barcelona's Yamal back for El Clásico", "2026-10-24T02:00:00Z"),
      ],
      teamInterest(teams, [], ["fcb"])
    );
    expect(lead?.id).toBe("ours");
  });
});
