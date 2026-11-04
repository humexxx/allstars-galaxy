// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));
vi.mock("@/app/actions/sports", () => ({ setSportFavoriteAction: vi.fn() }));

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { F1ClassificationRow, F1Driver, F1Race, F1SessionResult } from "@/types/sports";

import { AUSTIN, DRIVERS, SINGAPORE } from "./__fixtures__/f1";
import { F1RacePage } from "./f1-race-page";

function page(
  race: F1Race,
  {
    sessions = [],
    classification,
    drivers = DRIVERS,
    current = false,
    tab,
  }: {
    sessions?: F1SessionResult[];
    classification?: F1ClassificationRow[] | null;
    drivers?: F1Driver[];
    current?: boolean;
    tab?: string;
  } = {}
): React.ReactElement {
  return (
    <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
      <F1RacePage
        race={race}
        season={2026}
        drivers={drivers}
        classification={classification}
        sessions={sessions}
        current={current}
        favoriteSportIds={["f1"]}
        initialTab={tab}
      />
    </ReaderTimeZoneProvider>
  );
}

function renderPage(race: F1Race, options?: Parameters<typeof page>[1]): ReturnType<typeof render> {
  return render(page(race, options));
}

const section = (title: string): HTMLElement =>
  screen.getByRole("heading", { name: title }).closest("section")!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  refresh.mockClear();
});

describe("F1RacePage", () => {
  // Beside the circuit: the pill and the time under it.
  const besideCircuit = (pill: string): HTMLElement => screen.getByText(pill).closest("div")!.parentElement!;

  it("keeps F1's name row, its title a breadcrumb back to F1, and the sports beside it", () => {
    renderPage(AUSTIN);
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(trail).getByRole("link", { name: "Formula 1" })).toHaveAttribute(
      "href",
      "/portal/entertainment/sports?sport=f1"
    );
    expect(screen.getByRole("heading", { level: 1, name: "United States Grand Prix" })).toBeInTheDocument();
    const sports = screen.getByRole("group", { name: "Sports" });
    expect(within(sports).getByRole("link", { current: "page" })).toHaveAccessibleName("F1 (favorite)");
  });

  it("opens on the Overview, the results a tab beside it, locked until a session has run", () => {
    renderPage(AUSTIN);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Results"]);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Overview");
    expect(screen.getByRole("tab", { name: "Results" })).toBeDisabled();
  });

  it("opens on the results when the address asks for them", () => {
    renderPage(SINGAPORE, { classification: null, tab: "results" });
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Results");
  });

  it("names the next session of the race on now or next, and its time, not the race's", () => {
    renderPage(AUSTIN, { current: true });
    // 17:30Z is 11:30 AM in Costa Rica.
    expect(besideCircuit("Next · Practice 1")).toHaveTextContent("Fri, Oct 23, 11:30 AM");
    expect(besideCircuit("Next · Practice 1")).not.toHaveTextContent("Oct 25");
  });

  it("names the session on track while one is", () => {
    vi.setSystemTime(new Date("2026-10-24T17:20:00Z"));
    renderPage(AUSTIN, { current: true });
    expect(besideCircuit("On track · Sprint")).toHaveTextContent("Sat, Oct 24, 11:00 AM");
  });

  it("dates any other race by its Grand Prix", () => {
    renderPage(AUSTIN);
    expect(screen.queryByText(/^Next ·/)).toBeNull();
    expect(besideCircuit("Upcoming")).toHaveTextContent("Sun, Oct 25, 2:00 PM");
  });

  it("heads a race with its round, name and place, and its weekend in the reader's zone", () => {
    renderPage(AUSTIN);
    expect(screen.getByText("Round 18 · 2026 Season")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "United States Grand Prix" })).toBeInTheDocument();
    expect(screen.getByText("Circuit of the Americas · Austin, USA")).toBeInTheDocument();

    const weekend = within(section("Weekend")).getAllByRole("listitem");
    expect(weekend).toHaveLength(5);
    // 21:00Z is 3 PM in Costa Rica.
    expect(weekend[3]).toHaveTextContent("Qualifying");
    expect(weekend[3]).toHaveTextContent("Sat, Oct 24, 3:00 PM");
    // Nothing run yet, so no podium and no classification.
    expect(screen.queryByRole("heading", { name: "Podium" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Classification" })).toBeNull();
  });

  it("puts the podium with each driver's gap to the winner", () => {
    renderPage(SINGAPORE, { classification: null });
    const steps = within(section("Podium")).getAllByRole("listitem");
    expect(steps.map((s) => s.textContent)).toEqual([
      expect.stringMatching(/^1.*M\. Verstappen.*Red Bull.*1:32:11\.902$/),
      expect.stringMatching(/^2.*C\. Leclerc.*Ferrari.*\+5\.402$/),
      expect.stringMatching(/^3.*L\. Norris.*McLaren.*\+11\.237$/),
    ]);
  });

  it("marks pole, the fastest lap and the sprint", () => {
    renderPage(SINGAPORE, { classification: null });
    const marks = Object.fromEntries(
      screen.getAllByRole("term").map((dt) => [dt.textContent, dt.nextElementSibling?.textContent])
    );
    expect(marks).toEqual({
      Pole: "RUS1:30.641",
      "Fastest lap": "LEC1:33.418 · Lap 52",
      Sprint: "NORMcLaren",
    });
    // A grid of three on a phone: the lap wraps rather than being cut short.
    expect(screen.getByText("1:33.418 · Lap 52")).not.toHaveClass("truncate");
  });

  it("says plainly when the classification is not in yet, and asks again on Retry", () => {
    renderPage(SINGAPORE, { tab: "results", classification: null });

    const alert = within(section("Classification")).getByRole("alert");
    expect(alert).toHaveTextContent("The classification isn't available yet");
    // Usually the results are simply not in yet: not an error colour.
    expect(alert.className).not.toMatch(/destructive/);
    const status = within(section("Classification")).getByRole("status");
    expect(status).toHaveTextContent(/^$/);

    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    // Nothing came in: said, since the alert itself does not change.
    expect(status).toHaveTextContent("Still not available");
    expect(within(alert).getByRole("button", { name: "Retry" })).not.toHaveAttribute("aria-disabled");
  });

  it("hands focus to the classification's heading when a Retry brings it in", () => {
    const { rerender } = renderPage(SINGAPORE, { tab: "results", classification: null });
    const retry = screen.getByRole("button", { name: "Retry" });
    retry.focus();
    fireEvent.click(retry);

    rerender(
      page(SINGAPORE, { tab: "results",
        classification: [
          { position: "1", code: "VER", name: "M. Verstappen", team: "Red Bull", result: "1:32:11.902", points: 25 },
        ],
      })
    );

    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Classification" }));
    expect(within(section("Classification")).getByRole("status")).toHaveTextContent(/^$/);
  });

  it("leaves focus where the reader took it while the Retry was out", () => {
    const { rerender } = renderPage(SINGAPORE, { tab: "results", classification: null });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    const breadcrumb = screen.getByRole("link", { name: "Formula 1" });
    breadcrumb.focus();

    rerender(
      page(SINGAPORE, { tab: "results",
        classification: [
          { position: "1", code: "VER", name: "M. Verstappen", team: "Red Bull", result: "1:32:11.902", points: 25 },
        ],
      })
    );

    expect(document.activeElement).toBe(breadcrumb);
  });

  it("lists the whole field once it is in, the fastest lap marked", () => {
    renderPage(SINGAPORE, { tab: "results",
      classification: [
        { position: "1", code: "VER", name: "M. Verstappen", team: "Red Bull", result: "1:32:11.902", points: 25 },
        { position: "2", code: "LEC", name: "C. Leclerc", team: "Ferrari", result: "+5.402", points: 19, fastestLap: true },
        { position: "DNF", code: "STR", name: "L. Stroll", team: "Aston Martin", result: "Retired", points: 0 },
      ],
    });
    const rows = within(within(section("Classification")).getByRole("table", { name: "Classification" })).getAllByRole("row");
    expect(rows.slice(1).map((r) => [...r.querySelectorAll("td")].map((td) => td.textContent))).toEqual([
      ["1", "M. VerstappenRed Bull", "1:32:11.902", "25"],
      // Named for a screen reader beside the icon.
      ["2", "C. LeclercFerrari", "Fastest lap+5.402", "19"],
      ["DNF", "L. StrollAston Martin", "Retired", "0"],
    ]);
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
      renderPage(AUSTIN, { tab: "results", sessions: [fp1, quali] });
      const results = section("Sessions");
      // Each pick reads as it shows, its full name after it.
      expect(within(results).getByRole("radio", { name: "Q (Qualifying)" })).toHaveAttribute("aria-checked", "true");
      expect(within(results).getByRole("table", { name: "Qualifying" })).toHaveTextContent("L. Norris");
      expect(within(results).getByRole("table", { name: "Qualifying" })).toHaveTextContent("Q31:32.501");

      fireEvent.click(within(results).getByRole("radio", { name: "P1 (Practice 1)" }));

      const table = within(results).getByRole("table", { name: "Practice 1" });
      // No faces in the fixture: each driver is the disc with their code.
      expect(within(table).getAllByRole("row").map((r) => r.textContent)).toEqual([
        "PosDriverTimeGap",
        "1LECC. LeclercFerrari1:36.052",
        "2VERM. VerstappenRed Bull Racing1:36.120+0.068",
      ]);
    });

    it("moves to a session that comes in with a refresh, until the reader picks one", () => {
      const sprint = { kind: "sprint" as const, rows: [{ position: "1", code: "VER", name: "M. Verstappen", team: "Red Bull Racing", time: "28:01.115" }] };
      const { rerender } = renderPage(AUSTIN, { tab: "results", sessions: [fp1] });
      expect(within(section("Sessions")).getByRole("table", { name: "Practice 1" })).toBeInTheDocument();

      rerender(page(AUSTIN, { tab: "results", sessions: [fp1, quali] }));
      expect(within(section("Sessions")).getByRole("table", { name: "Qualifying" })).toBeInTheDocument();

      fireEvent.click(within(section("Sessions")).getByRole("radio", { name: "P1 (Practice 1)" }));
      rerender(page(AUSTIN, { tab: "results", sessions: [fp1, quali, sprint] }));
      expect(within(section("Sessions")).getByRole("table", { name: "Practice 1" })).toBeInTheDocument();
      expect(within(section("Sessions")).getByRole("radio", { name: "Sprint" })).toHaveAttribute("aria-checked", "false");
    });

    it("draws each driver by their face from the standings, by the name there too", () => {
      const faces = DRIVERS.map((d) =>
        d.code === "LEC" ? { ...d, shortName: "C. Leclerc", imageUrl: "https://a.espncdn.com/i/headshots/rpm/players/full/5498.png" } : d
      );
      renderPage(AUSTIN, { tab: "results", sessions: [fp1], drivers: faces });
      const [, leclerc, verstappen] = within(section("Sessions")).getAllByRole("row");
      expect(leclerc.querySelector("img")).not.toBeNull();
      expect(verstappen.querySelector("img")).toBeNull();
    });

    it("leaves a finished race to the classification below, with its points", () => {
      const race = { kind: "race" as const, rows: [{ position: "1", code: "VER", name: "M. Verstappen", team: "Red Bull Racing", time: "1:32:11.902" }] };
      renderPage(SINGAPORE, { tab: "results", sessions: [quali, race], classification: null });
      expect(within(section("Sessions")).queryByRole("radio")).toBeNull();
      expect(within(section("Sessions")).getByRole("table", { name: "Qualifying" })).toBeInTheDocument();
    });

    it("has no results without any session in", () => {
      renderPage(AUSTIN, { tab: "results" });
      expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Overview");
      expect(screen.queryByRole("heading", { name: "Sessions" })).toBeNull();
    });
  });
});
