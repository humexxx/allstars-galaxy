import { describe, expect, it } from "vitest";

import { espnImage } from "./espn-images";

describe("espnImage", () => {
  it("asks ESPN's resizer for a square at the drawn size", () => {
    // A 600×436 headshot is ~230 KB; the resizer returns it at ~15 KB.
    expect(espnImage("https://a.espncdn.com/i/headshots/tennis/players/full/3623.png")).toBe(
      "https://a.espncdn.com/combiner/i?img=/i/headshots/tennis/players/full/3623.png&w=96&h=96&scale=crop"
    );
    expect(espnImage("https://a.espncdn.com/i/teamlogos/nba/500/gs.png", 48)).toBe(
      "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/gs.png&w=48&h=48&scale=crop"
    );
  });

  it("leaves anything that is not an ESPN CDN image alone", () => {
    expect(espnImage("https://media.padelapi.org/player-api/agustin-tapia.webp")).toBe(
      "https://media.padelapi.org/player-api/agustin-tapia.webp"
    );
    expect(espnImage("https://a.espncdn.com/combiner/i?img=/i/x.png&w=96&h=96")).toBe(
      "https://a.espncdn.com/combiner/i?img=/i/x.png&w=96&h=96"
    );
  });

  it("has nothing for a missing or malformed URL", () => {
    expect(espnImage(undefined)).toBeUndefined();
    expect(espnImage("")).toBeUndefined();
    expect(espnImage("not a url")).toBeUndefined();
  });
});
