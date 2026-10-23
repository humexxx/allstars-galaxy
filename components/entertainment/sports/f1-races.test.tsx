// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/f1", () => ({
  getF1RaceClassificationAction: vi.fn(),
  getF1WeekendResultsAction: vi.fn(async () => ({
    success: true,
    data: { season: 2026, round: 0, sessions: [] },
  })),
}));

import { getF1RaceClassificationAction, getF1WeekendResultsAction } from "@/app/actions/f1";
import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { F1Data, F1WeekendResults } from "@/types/sports";

import { F1_SEASON } from "./__fixtures__/f1";
import { F1Races } from "./f1-races";

function renderRaces(data: F1Data = F1_SEASON, weekend?: F1WeekendResults): void {
  render(
    <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
      <F1Races data={data} weekend={weekend} />
    </ReaderTimeZoneProvider>
  );
}

const featuredCard = (): HTMLElement =>
  screen.getByRole("heading", { name: "United States Grand Prix" }).closest('[data-slot="card"]')!;

const section = (title: string): HTMLElement =>
  screen.getByRole("heading", { name: title }).closest("section")!;
const tiles = (title: string): HTMLElement[] => within(section(title)).getAllByRole("button");
const sheet = (): HTMLElement => screen.getByRole("dialog");
const calendar = (): HTMLElement => screen.getByRole("list", { name: "Season calendar" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // Monday before Austin, 06:00 in Costa Rica.
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("F1Races", () => {
  it("leads with the next race, in the reader's zone, and what its weekend runs next", () => {
    renderRaces();
    const featured = featuredCard();

    // "Next race" is the heading above the card, which names the round.
    expect(featured.closest("section")?.querySelector("h3")).toHaveTextContent("Next race");
    expect(featured).toHaveTextContent(/^Round 18/);
    expect(featured.querySelector('[data-slot="badge"]')).toHaveTextContent("Sprint");
    expect(featured).toHaveTextContent("Circuit of the Americas · Austin, USA");
    // 20:00Z is 2 PM in Costa Rica.
    expect(featured).toHaveTextContent("Sun, Oct 25, 2:00 PM");
    expect(featured).toHaveTextContent("Practice 1 in 4d");
    const sessions = within(featured).getAllByRole("listitem");
    expect(sessions.map((li) => li.firstElementChild?.textContent)).toEqual([
      "Practice 1Next",
      "Sprint Qualifying",
      "Sprint",
      "Qualifying",
      "Race",
    ]);
  });

  it("calls a race weekend under way, with the session on track", () => {
    vi.setSystemTime(new Date("2026-10-24T17:20:00Z"));
    renderRaces();
    const featured = featuredCard();
    expect(within(featured).getByText("Sprint live")).toBeInTheDocument();
  });

  it("lists the three races after it under Coming up", () => {
    renderRaces();
    expect(tiles("Coming up").map((t) => within(t).getByText(/Grand Prix$/).textContent)).toEqual([
      "Mexico City Grand Prix",
      "São Paulo Grand Prix",
      "Las Vegas Grand Prix",
    ]);
  });

  it("lists the three just run, latest first, with winner, pole and fastest lap", () => {
    renderRaces();
    const [singapore, baku, monza] = tiles("Just finished");
    expect(within(singapore).getByText("Singapore Grand Prix")).toBeInTheDocument();
    expect(within(baku).getByText("Azerbaijan Grand Prix")).toBeInTheDocument();
    expect(within(monza).getByText("Italian Grand Prix")).toBeInTheDocument();
    expect(tiles("Just finished")).toHaveLength(3);

    // Winner VER, pole RUS, fastest lap LEC — each named for a screen reader.
    expect(singapore).toHaveTextContent(/WinnerVER/);
    expect(singapore).toHaveTextContent(/PoleRUS/);
    expect(singapore).toHaveTextContent(/Fastest lapLEC/);
  });

  it("folds the full calendar away until asked for", () => {
    renderRaces();
    expect(screen.queryByRole("list", { name: "Season calendar" })).toBeNull();
    const toggle = screen.getByRole("button", { name: "Full calendar" });
    fireEvent.click(toggle);

    expect(toggle).toHaveTextContent("Hide calendar");
    const rows = within(calendar()).getAllByRole("button");
    expect(rows).toHaveLength(F1_SEASON.races.length);
    // The next race is marked, a finished one shows its winner.
    expect(rows[4]).toHaveTextContent("Next");
    expect(rows[3]).toHaveTextContent("VER");

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("Full calendar");
  });

  it("opens a finished race's sheet from its tile and loads its classification", async () => {
    vi.mocked(getF1RaceClassificationAction).mockResolvedValue({
      success: true,
      data: {
        season: 2026,
        round: 17,
        rows: [
          { position: "1", code: "VER", name: "M. Verstappen", team: "Red Bull", result: "1:32:11.902", points: 25 },
        ],
      },
    });
    renderRaces();
    fireEvent.click(tiles("Just finished")[0]);

    expect(within(sheet()).getByRole("heading", { name: "Singapore Grand Prix" })).toBeInTheDocument();
    expect(getF1RaceClassificationAction).toHaveBeenCalledWith({ season: 2026, round: 17 });
    expect(within(sheet()).getByRole("status", { name: "Loading the classification" })).toBeInTheDocument();
    const table = await within(sheet()).findByRole("table");
    expect(within(table).getByText("M. Verstappen")).toBeInTheDocument();
    expect(within(table).getByText("1:32:11.902")).toBeInTheDocument();
  });

  it("asks once per race for the visit, and again only after a failure", async () => {
    vi.mocked(getF1RaceClassificationAction)
      .mockResolvedValueOnce({ success: false, error: "The classification isn't available yet" })
      .mockResolvedValueOnce({
        success: true,
        data: {
          season: 2026,
          round: 17,
          rows: [
            { position: "1", code: "VER", name: "M. Verstappen", team: "Red Bull", result: "1:32:11.902", points: 25 },
          ],
        },
      });
    renderRaces();
    fireEvent.click(tiles("Just finished")[0]);

    const alert = await within(sheet()).findByRole("alert");
    expect(alert).toHaveTextContent("The classification isn't available yet");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await within(sheet()).findByRole("table")).toBeInTheDocument();
    expect(getF1RaceClassificationAction).toHaveBeenCalledTimes(2);

    // Closed and opened again: the rows are kept, nothing is asked.
    fireEvent.keyDown(sheet(), { key: "Escape" });
    fireEvent.click(tiles("Just finished")[0]);
    expect(within(sheet()).getByRole("table")).toBeInTheDocument();
    expect(getF1RaceClassificationAction).toHaveBeenCalledTimes(2);
  });

  it("opens an upcoming race from the calendar without asking for results", () => {
    renderRaces();
    fireEvent.click(screen.getByRole("button", { name: "Full calendar" }));
    fireEvent.click(within(calendar()).getByRole("button", { name: /Qatar Grand Prix/ }));

    expect(within(sheet()).getByRole("heading", { name: "Qatar Grand Prix" })).toBeInTheDocument();
    expect(within(sheet()).queryByText("Classification")).toBeNull();
    expect(getF1RaceClassificationAction).not.toHaveBeenCalled();
  });

  it("hands the focus back to the race that opened the sheet", async () => {
    renderRaces();
    const tile = tiles("Coming up")[0];
    tile.focus();
    fireEvent.click(tile);
    expect(within(sheet()).getByRole("heading", { name: "Mexico City Grand Prix" })).toBeInTheDocument();
    await waitFor(() => expect(sheet()).toContainElement(document.activeElement as HTMLElement));

    fireEvent.keyDown(sheet(), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(tile));
  });

  it("opens the featured race from View details; the card itself is not a button and does not grey", () => {
    renderRaces();
    expect(featuredCard().className).not.toMatch(/hover:bg/);
    expect(screen.queryByRole("button", { name: "United States Grand Prix" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View details: United States Grand Prix" }));

    expect(within(sheet()).getByRole("heading", { name: "United States Grand Prix" })).toBeInTheDocument();
  });

  it("shows who led each session run so far in the card's timetable", () => {
    vi.setSystemTime(new Date("2026-10-24T03:00:00Z"));
    renderRaces(F1_SEASON, {
      season: 2026,
      round: 18,
      sessions: [
        {
          kind: "fp1",
          rows: [
            { position: "1", code: "LEC", name: "C. Leclerc", team: "Ferrari", teamColor: "#E8002D", time: "1:36.052" },
            { position: "2", code: "VER", name: "M. Verstappen", team: "Red Bull Racing", time: "1:36.120", gap: "+0.068" },
          ],
        },
        { kind: "sprint-qualifying", rows: [{ position: "1", code: "NOR", name: "L. Norris", team: "McLaren", time: "1:33.200", segment: "Q3" }] },
      ],
    });
    const rows = within(featuredCard()).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent(/^Practice 1Fastest:C. Leclerc1:36.052$/);
    expect(rows[1]).toHaveTextContent(/^Sprint QualifyingSprint pole:L. Norris1:33.200$/);
    // Still to run: its time, not a result.
    expect(rows[2]).toHaveTextContent("Sprint");
    expect(rows[2]).not.toHaveTextContent("Winner");
  });

  it("asks for a race's sessions when its sheet opens, once its weekend has started", () => {
    renderRaces();
    fireEvent.click(tiles("Just finished")[0]);
    expect(getF1WeekendResultsAction).toHaveBeenCalledWith(
      expect.objectContaining({ season: 2026, round: expect.any(Number) })
    );
  });

  it("does not ask for the sessions of a weekend still to start", () => {
    renderRaces();
    fireEvent.click(screen.getByRole("button", { name: "View details: United States Grand Prix" }));
    expect(getF1WeekendResultsAction).not.toHaveBeenCalled();
  });

  it("says the season is over when nothing is left to run", () => {
    const over: F1Data = {
      ...F1_SEASON,
      races: F1_SEASON.races.filter((r) => r.status === "completed"),
    };
    renderRaces(over);
    expect(screen.getByText("The 2026 season is over")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Coming up" })).toBeNull();
    expect(tiles("Just finished")).toHaveLength(3);
  });
});
