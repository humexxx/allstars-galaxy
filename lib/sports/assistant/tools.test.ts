import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/services/sports-service", () => ({
  listUserSportsFavorites: vi.fn(async () => [{ sportId: "football" }]),
  setSportFavorite: vi.fn(async () => undefined),
}));
vi.mock("@/lib/services/impersonation", () => ({ logImpersonatedMutation: vi.fn(async () => undefined) }));
vi.mock("@/lib/sports/load", () => ({ loadSport: vi.fn() }));
vi.mock("@/lib/services/padel-api-service", async () => ({
  getPadelData: vi.fn(async () => (await import("@/lib/data/sports/padel")).PADEL_DATA),
}));
vi.mock("@/lib/services/espn-tennis-service", async () => ({
  getTennisData: vi.fn(async () => (await import("@/lib/data/sports/tennis")).TENNIS_DATA),
}));
vi.mock("@/lib/services/jolpica-f1-service", async () => ({
  getF1Data: vi.fn(async () => (await import("@/lib/data/sports/f1")).F1_DATA),
}));

import type Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";

import { F1_DATA } from "@/lib/data/sports/f1";
import { getFootballLeague } from "@/lib/data/sports/football";
import { logImpersonatedMutation } from "@/lib/services/impersonation";
import { listUserSportsFavorites, setSportFavorite } from "@/lib/services/sports-service";
import { loadSport } from "@/lib/sports/load";
import type { SportsAssistantEvent } from "@/types/sports-assistant";

import { listPages, resolveDestination, revalidateFavoritePaths, runSportsTool, type SportsToolContext } from "./tools";

const USER = "user-1";

function context(overrides: Partial<SportsToolContext> = {}): SportsToolContext {
  return {
    userId: USER,
    role: "admin",
    isImpersonating: false,
    timeZone: "UTC",
    onFavoritesChanged: vi.fn(),
    ...overrides,
  };
}

async function run(name: string, input: unknown, ctx = context()) {
  const events: SportsAssistantEvent[] = [];
  const tool = { type: "tool_use", id: "toolu_1", name, input } as Anthropic.Beta.BetaToolUseBlock;
  const result = await runSportsTool(tool, ctx, (e) => events.push(e));
  return { result, events, ctx };
}

beforeEach(() => vi.clearAllMocks());

describe("navigate", () => {
  const admin = { role: "admin" as const, isImpersonating: false };

  it("opens a sport on a competition and a tab with the hub's own addresses", async () => {
    await expect(
      resolveDestination({ kind: "sport", sportId: "football", competition: "uefa-champions-league", tab: "knockout" }, admin)
    ).resolves.toEqual({
      href: "/portal/entertainment/sports?sport=football&league=uefa-champions-league&tab=knockout",
      label: "UEFA Champions League, knockout tab",
    });
    await expect(resolveDestination({ kind: "sport", sportId: "nba" }, admin)).resolves.toMatchObject({
      href: "/portal/entertainment/sports?sport=nba",
    });
    await expect(
      resolveDestination({ kind: "sport", sportId: "lol", competition: "worlds", tab: "swiss" }, admin)
    ).resolves.toMatchObject({ href: "/portal/entertainment/sports?sport=lol&league=worlds&tab=swiss" });
  });

  it("opens a tournament, a race and the World Cup's own tabs", async () => {
    await expect(
      resolveDestination({ kind: "sport", sportId: "tennis", tournamentId: "atp-rg", tab: "overview" }, admin)
    ).resolves.toEqual({ href: "/portal/entertainment/sports/tennis/atp-rg?tab=overview", label: "Roland Garros" });
    const round = F1_DATA.races[0].round;
    await expect(resolveDestination({ kind: "sport", sportId: "f1", round, tab: "results" }, admin)).resolves.toEqual({
      href: `/portal/entertainment/sports/f1/${round}?tab=results`,
      label: F1_DATA.races[0].name,
    });
    await expect(
      resolveDestination({ kind: "sport", sportId: "football", competition: "world-cup", tab: "groups" }, admin)
    ).resolves.toMatchObject({ href: "/portal/entertainment/sports?sport=football&league=world-cup&tab=groups" });
  });

  it("opens another part of the portal from the sidebar's own list", async () => {
    await expect(resolveDestination({ kind: "page", page: "plans" }, admin)).resolves.toEqual({
      href: "/portal/plans",
      label: "Plans",
    });
    await expect(resolveDestination({ kind: "page", page: "settings" }, admin)).resolves.toMatchObject({
      href: "/portal/settings",
    });
  });

  it("rejects what the app has no page for, saying what it has", async () => {
    const { result, events } = await run("navigate", {
      destination: { kind: "sport", sportId: "football", competition: "eredivisie" },
    });
    expect(result).toMatchObject({ is_error: true, content: expect.stringMatching(/no competition "eredivisie".*la-liga/) });
    expect(events).toEqual([]);

    await expect(resolveDestination({ kind: "sport", sportId: "nba", tab: "knockout" }, admin)).rejects.toThrow(
      /no "knockout" tab\. Tabs: overview, bracket, news/
    );
    await expect(resolveDestination({ kind: "sport", sportId: "nba", tournamentId: "x" }, admin)).rejects.toThrow(
      /Only padel and tennis/
    );
    await expect(resolveDestination({ kind: "sport", sportId: "tennis", tournamentId: "nope" }, admin)).rejects.toThrow(
      /No Tennis tournament has the id "nope"/
    );
    await expect(resolveDestination({ kind: "sport", sportId: "f1", round: 39 }, admin)).rejects.toThrow(/no round 39/);
    await expect(resolveDestination({ kind: "page", page: "admin" }, admin)).rejects.toThrow(/no page "admin"/);
  });

  it("never offers the admin pages while impersonating", async () => {
    const pages = listPages({ role: "admin", isImpersonating: true }).map((p) => p.id);
    expect(pages).toContain("dashboard");
    expect(pages).not.toContain("users");
    expect(listPages({ role: "admin", isImpersonating: false }).map((p) => p.id)).toContain("users");
    await expect(
      resolveDestination({ kind: "page", page: "users" }, { role: "admin", isImpersonating: true })
    ).rejects.toThrow(/no page "users"/);
  });

  it("sends the page to open and tells the model where the user is", async () => {
    const { result, events } = await run("navigate", { destination: { kind: "sport", sportId: "f1", tab: "news" } });
    expect(events).toEqual([{ type: "navigate", href: "/portal/entertainment/sports?sport=f1&tab=news" }]);
    expect(result).toMatchObject({ content: "The user now has Formula 1, news tab open." });
  });
});

describe("set_favorite", () => {
  it("adds a favourite for the effective user, logs it and has the page refreshed", async () => {
    const { result, events, ctx } = await run("set_favorite", { sportId: "nba", favorite: true });

    expect(listUserSportsFavorites).toHaveBeenCalledWith(USER);
    expect(setSportFavorite).toHaveBeenCalledWith(USER, "nba", true);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: "sportFavorite.add", metadata: { sportId: "nba" } })
    );
    expect(ctx.onFavoritesChanged).toHaveBeenCalledOnce();
    expect(events).toContainEqual({ type: "refresh" });
    expect(result).toMatchObject({ content: "NBA is now one of the user's favourites." });
  });

  it("removes one", async () => {
    await run("set_favorite", { sportId: "football", favorite: false });
    expect(setSportFavorite).toHaveBeenCalledWith(USER, "football", false);
  });

  it("says when it was already so, and writes nothing", async () => {
    const { result, events, ctx } = await run("set_favorite", { sportId: "football", favorite: true });
    expect(setSportFavorite).not.toHaveBeenCalled();
    expect(ctx.onFavoritesChanged).not.toHaveBeenCalled();
    expect(events).not.toContainEqual({ type: "refresh" });
    expect(result).toMatchObject({ content: expect.stringMatching(/already one of .* nothing changed/) });
  });

  it("refuses a sport the app does not have", async () => {
    const { result } = await run("set_favorite", { sportId: "cricket", favorite: true });
    expect(result).toMatchObject({ is_error: true });
    expect(setSportFavorite).not.toHaveBeenCalled();
  });

  it("expires what the favourites action expires", () => {
    revalidateFavoritePaths();
    expect(revalidatePath).toHaveBeenCalledWith("/portal/entertainment/sports");
    expect(revalidatePath).toHaveBeenCalledWith("/portal");
  });
});

describe("get_sport and list_sports", () => {
  it("reads the page's own feed, for the league asked for, and answers with its summary", async () => {
    vi.mocked(loadSport).mockResolvedValue({
      sport: "football",
      league: getFootballLeague("la-liga"),
      options: [],
    });
    const { result, events } = await run("get_sport", { sportId: "football", competition: "la-liga" });

    expect(loadSport).toHaveBeenCalledWith("football", { league: "la-liga" });
    expect(events).toEqual([{ type: "status", label: "Reading Football" }]);
    const summary = JSON.parse(result.content as string);
    expect(summary).toMatchObject({ sport: "football", competition: { id: "la-liga" } });
  });

  it("marks the user's favourites among every sport", async () => {
    const { result } = await run("list_sports", {});
    const { sports } = JSON.parse(result.content as string) as { sports: { id: string; favorite: boolean; tabs: string[] }[] };
    expect(sports).toHaveLength(10);
    expect(sports.find((s) => s.id === "football")).toMatchObject({ favorite: true });
    expect(sports.find((s) => s.id === "nba")).toMatchObject({ favorite: false });
    expect(sports.find((s) => s.id === "lol")?.tabs).toContain("swiss: Swiss stage (Worlds)");
  });
});
