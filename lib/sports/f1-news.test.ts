import { describe, expect, it } from "vitest";

import { F1_DATA } from "@/lib/data/sports/f1";
import type { F1NewsArticle } from "@/types/sports";

import { leadStory } from "./f1-news";

const article = (id: string, headline: string, seen: string, image = true): F1NewsArticle => ({
  id,
  headline,
  description: null,
  link: null,
  images: image ? [{ url: `https://a.espncdn.com/photo/${id}.jpg`, width: 1296, height: 729 }] : [],
  firstSeenAt: new Date(seen),
});

// F1_DATA leads with round 7 and its standings with Antonelli, Russell, Leclerc.
const race = F1_DATA.races.find((r) => r.status === "upcoming")!;
const place = race.name.replace(/\s*Grand Prix$/, "");

describe("leadStory", () => {
  it("leads with the latest refresh's story about the weekend and its leaders", () => {
    const { lead, rest } = leadStory(
      [
        article("a", "Christian Horner to Mercedes? Ex-Red Bull boss reveals approach", "2026-10-24T00:00:00Z"),
        article("b", `Leclerc quickest in practice at the ${place} Grand Prix ahead of Antonelli`, "2026-10-24T00:00:00Z"),
        article("c", "Bearman 'ready to fight for podiums'", "2026-10-24T00:00:00Z"),
      ],
      F1_DATA
    );
    expect(lead?.id).toBe("b");
    expect(rest.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("will not lead with yesterday's refresh, however apt", () => {
    const { lead } = leadStory(
      [
        article("old", `Antonelli wins the ${place} Grand Prix from pole`, "2026-10-22T00:00:00Z"),
        article("new", "FIA president hints at V8 engine return", "2026-10-24T00:00:00Z"),
      ],
      F1_DATA
    );
    expect(lead?.id).toBe("new");
  });

  it("prefers a story with a picture to lead with, and the wire's order on a tie", () => {
    const { lead } = leadStory(
      [
        article("bare", "Antonelli on pole", "2026-10-24T00:00:00Z", false),
        article("first", "Hamilton's advice", "2026-10-24T00:00:00Z"),
        article("second", "Slater to join Audi", "2026-10-24T00:00:00Z"),
      ],
      F1_DATA
    );
    expect(lead?.id).toBe("first");
  });

  it("has nothing to lead with on an empty wire", () => {
    expect(leadStory([], F1_DATA)).toEqual({ lead: null, rest: [] });
  });
});
