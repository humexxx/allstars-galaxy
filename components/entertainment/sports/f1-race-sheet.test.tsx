// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/f1", () => ({
  getF1RaceClassificationAction: vi.fn(),
  getF1WeekendResultsAction: vi.fn(),
}));

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { F1Race } from "@/types/sports";

import { AUSTIN, DRIVERS, SINGAPORE } from "./__fixtures__/f1";
import { F1RaceSheet, type ClassificationState, type WeekendState } from "./f1-race-sheet";

function stubViewport(phone: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: phone, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
}

function renderSheet(
  race: F1Race,
  classification?: ClassificationState,
  onRetry: () => void = vi.fn(),
  weekend?: WeekendState,
  onRetryWeekend: () => void = vi.fn()
): void {
  render(
    <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
      <F1RaceSheet
        race={race}
        open
        onOpenChange={vi.fn()}
        season={2026}
        drivers={DRIVERS}
        classification={classification}
        onRetry={onRetry}
        weekend={weekend}
        onRetryWeekend={onRetryWeekend}
      />
    </ReaderTimeZoneProvider>
  );
}

const sheet = (): HTMLElement => screen.getByRole("dialog");
const section = (title: string): HTMLElement =>
  within(sheet()).getByRole("heading", { name: title }).closest("section")!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
  stubViewport(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("F1RaceSheet", () => {
  it("heads a race with its round, name and place, and its weekend in the reader's zone", () => {
    renderSheet(AUSTIN);
    expect(within(sheet()).getByText("Round 18 · 2026")).toBeInTheDocument();
    expect(within(sheet()).getByRole("heading", { name: "United States Grand Prix" })).toBeInTheDocument();
    expect(sheet()).toHaveAccessibleDescription("Circuit of the Americas · Austin, USA");

    const weekend = within(section("Weekend")).getAllByRole("listitem");
    expect(weekend).toHaveLength(5);
    // 21:00Z is 3 PM in Costa Rica.
    expect(weekend[3]).toHaveTextContent("Qualifying");
    expect(weekend[3]).toHaveTextContent("Sat, Oct 24, 3:00 PM");
    // Nothing run yet, so no podium and no classification.
    expect(within(sheet()).queryByRole("heading", { name: "Podium" })).toBeNull();
    expect(within(sheet()).queryByRole("heading", { name: "Classification" })).toBeNull();
  });

  it("puts the podium with each driver's gap to the winner", () => {
    renderSheet(SINGAPORE, { status: "loading" });
    const steps = within(section("Podium")).getAllByRole("listitem");
    expect(steps.map((s) => s.textContent)).toEqual([
      expect.stringMatching(/^1.*M\. Verstappen.*Red Bull.*1:32:11\.902$/),
      expect.stringMatching(/^2.*C\. Leclerc.*Ferrari.*\+5\.402$/),
      expect.stringMatching(/^3.*L\. Norris.*McLaren.*\+11\.237$/),
    ]);
  });

  it("marks pole, the fastest lap and the sprint", () => {
    renderSheet(SINGAPORE, { status: "loading" });
    const marks = Object.fromEntries(
      within(sheet())
        .getAllByRole("term")
        .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent])
    );
    expect(marks).toEqual({
      Pole: "RUS1:30.641",
      "Fastest lap": "LEC1:33.418 · Lap 52",
      Sprint: "NORMcLaren",
    });
  });

  it("holds the classification's place while it loads", () => {
    renderSheet(SINGAPORE, { status: "loading" });
    expect(
      within(section("Classification")).getByRole("status", { name: "Loading the classification" })
    ).toBeInTheDocument();
  });

  it("says why the classification is missing, plainly, and offers a retry", () => {
    const onRetry = vi.fn();
    renderSheet(SINGAPORE, { status: "error", message: "The classification isn't available yet" }, onRetry);

    const alert = within(section("Classification")).getByRole("alert");
    expect(alert).toHaveTextContent("The classification isn't available yet");
    // Usually the results are simply not in yet: not an error colour.
    expect(alert.className).not.toMatch(/destructive/);
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("lists the whole field once it is in, the fastest lap marked", () => {
    renderSheet(SINGAPORE, {
      status: "ready",
      rows: [
        { position: "1", code: "VER", name: "M. Verstappen", team: "Red Bull", result: "1:32:11.902", points: 25 },
        { position: "2", code: "LEC", name: "C. Leclerc", team: "Ferrari", result: "+5.402", points: 19, fastestLap: true },
        { position: "DNF", code: "STR", name: "L. Stroll", team: "Aston Martin", result: "Retired", points: 0 },
      ],
    });
    const rows = within(within(section("Classification")).getByRole("table")).getAllByRole("row");
    expect(rows.slice(1).map((r) => [...r.querySelectorAll("td")].map((td) => td.textContent))).toEqual([
      ["1", "M. VerstappenRed Bull", "1:32:11.902", "25"],
      ["2", "C. LeclercFerrari", "+5.402", "19"],
      ["DNF", "L. StrollAston Martin", "Retired", "0"],
    ]);
    expect(within(rows[2]).getByLabelText("Fastest lap")).toBeInTheDocument();
  });

  it("slides in from the right on a desktop", () => {
    renderSheet(AUSTIN);
    expect(sheet()).toHaveAttribute("data-side", "right");
  });

  it("rises from the bottom on a phone", () => {
    stubViewport(true);
    renderSheet(AUSTIN);
    expect(sheet()).toHaveAttribute("data-side", "bottom");
  });

  describe("Results", () => {
    const fp1 = {
      kind: "fp1" as const,
      rows: [
        { position: "1", code: "LEC", name: "C. Leclerc", team: "Ferrari", teamColor: "#E8002D", time: "1:36.052" },
        { position: "2", code: "VER", name: "M. Verstappen", team: "Red Bull Racing", time: "1:36.120", gap: "+0.068" },
      ],
    };
    const quali = {
      kind: "qualifying" as const,
      rows: [{ position: "1", code: "NOR", name: "L. Norris", team: "McLaren", time: "1:32.501", segment: "Q3" as const }],
    };

    it("shows the latest session's order, with a pick of the others", () => {
      renderSheet(AUSTIN, undefined, vi.fn(), { status: "ready", sessions: [fp1, quali] });
      const results = section("Results");
      expect(within(results).getByRole("radio", { name: "Qualifying" })).toHaveAttribute("aria-checked", "true");
      expect(within(results).getByRole("table", { name: "Qualifying" })).toHaveTextContent("L. Norris");
      expect(within(results).getByRole("table", { name: "Qualifying" })).toHaveTextContent("Q31:32.501");

      fireEvent.click(within(results).getByRole("radio", { name: "Practice 1" }));

      const table = within(results).getByRole("table", { name: "Practice 1" });
      expect(within(table).getAllByRole("row").map((r) => r.textContent)).toEqual([
        "PosDriverTimeGap",
        "1C. LeclercFerrari1:36.052",
        "2M. VerstappenRed Bull Racing1:36.120+0.068",
      ]);
    });

    it("leaves a finished race to the classification below, with its points", () => {
      const race = { kind: "race" as const, rows: [{ position: "1", code: "VER", name: "M. Verstappen", team: "Red Bull Racing", time: "1:32:11.902" }] };
      renderSheet(SINGAPORE, { status: "loading" }, vi.fn(), { status: "ready", sessions: [quali, race] });
      expect(within(section("Results")).queryByRole("radio")).toBeNull();
      expect(within(section("Results")).getByRole("table", { name: "Qualifying" })).toBeInTheDocument();
    });

    it("holds its place while the sessions load", () => {
      renderSheet(SINGAPORE, undefined, vi.fn(), { status: "loading" });
      expect(within(section("Results")).getByRole("status", { name: "Loading the sessions" })).toBeInTheDocument();
    });

    it("says plainly when the sessions could not be read, with a retry", () => {
      const retry = vi.fn();
      renderSheet(SINGAPORE, undefined, vi.fn(), { status: "error", message: "Couldn't load the sessions" }, retry);
      fireEvent.click(within(section("Results")).getByRole("button", { name: "Retry" }));
      expect(retry).toHaveBeenCalled();
    });

    it("has no Results without any session in", () => {
      renderSheet(AUSTIN, undefined, vi.fn(), { status: "ready", sessions: [] });
      expect(within(sheet()).queryByRole("heading", { name: "Results" })).toBeNull();
    });
  });
});
