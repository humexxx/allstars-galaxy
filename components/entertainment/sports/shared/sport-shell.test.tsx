// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SportBarEnd, SportShell } from "./sport-shell";

function renderShell(
  defaultValue = "overview",
  overview: ReactNode = "Matches"
): ReturnType<typeof render> {
  return render(
    <Tabs defaultValue={defaultValue}>
      <SportShell
        emoji="⚽"
        title="UEFA Champions League"
        subtitle="Europe · Season 2026"
        controls={<button type="button">League</button>}
        tabs={
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="knockout">Knockout</TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="overview">{overview}</TabsContent>
        <TabsContent value="knockout">Bracket</TabsContent>
      </SportShell>
    </Tabs>
  );
}

/** The sticky row the tablist sits in (through its sideways scroller). */
const tabsRow = (): HTMLElement => screen.getByRole("tablist").closest<HTMLElement>(".sticky")!;

const rect = (top: number, bottom: number): DOMRect =>
  ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top }) as DOMRect;

/** The tabs row reaches `barBottom`; the panel's box starts at `contentTop`. */
function place(barBottom: number, contentTop: number): void {
  const content = screen.getByRole("tabpanel").parentElement!;
  vi.spyOn(tabsRow(), "getBoundingClientRect").mockReturnValue(rect(barBottom - 48, barBottom));
  vi.spyOn(content, "getBoundingClientRect").mockReturnValue(rect(contentTop, contentTop + 2000));
}

const span = (left: number, right: number): DOMRect =>
  ({ left, right, top: 0, bottom: 0, width: right - left, height: 0, x: left, y: 0 }) as DOMRect;

/** A 300px tabs row whose selected tab spans `selected`; anything else is empty. */
function placeSideways(selected: [number, number]): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.getAttribute("role") === "tab" && this.getAttribute("aria-selected") === "true") {
      return span(...selected);
    }
    if (this.firstElementChild?.getAttribute("role") === "tablist") return span(0, 300);
    return span(0, 0);
  });
}

const pick = (name: string): void => {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SportShell", () => {
  it("names the page: the competition is the one h1", () => {
    renderShell();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("UEFA Champions League");
    expect(screen.getByText("Europe · Season 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "League" })).toBeInTheDocument();
  });

  it("keeps the tabs in a sticky row of their own, clear of the app header", () => {
    renderShell();
    const row = tabsRow();
    expect(row).toHaveClass("sticky", "top-14", "md:top-0", "bg-background", "border-b");
    // The name is a row above it, which scrolls away.
    expect(row.contains(screen.getByRole("heading", { level: 1 }))).toBe(false);
  });

  it("lets the tabs scroll sideways inside their row rather than widen the page", () => {
    renderShell();
    const row = tabsRow();
    const scroller = screen.getByRole("tablist").parentElement!;
    expect(row).toHaveClass("min-w-0");
    expect(scroller.parentElement).toBe(row);
    expect(scroller).toHaveClass("min-w-0", "overflow-x-auto", "overflow-y-hidden");
  });

  it("puts a tab's own control at the end of the tabs row, and takes it away with the tab", () => {
    renderShell(
      "overview",
      <>
        <SportBarEnd>
          <button type="button">Filter</button>
        </SportBarEnd>
        Matches
      </>
    );
    const filter = screen.getByRole("button", { name: "Filter" });
    expect(tabsRow()).toContainElement(filter);
    expect(tabsRow().lastElementChild).toContainElement(filter);
    expect(screen.getByRole("tabpanel")).not.toContainElement(filter);

    pick("Knockout");

    expect(screen.queryByRole("button", { name: "Filter" })).toBeNull();
    expect(tabsRow().lastElementChild).toBeEmptyDOMElement();
  });

  it("reads top to bottom: the name and its controls, then the tabs", () => {
    renderShell();
    const tablist = screen.getByRole("tablist");
    const league = screen.getByRole("button", { name: "League" });
    expect(league.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tabsRow().contains(league)).toBe(false);
  });

  it("puts a small copy of the name in the tabs row once the name has scrolled away", () => {
    let report: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
          report = callback;
        }
        observe(): void {}
        disconnect(): void {}
      }
    );
    renderShell();
    const row = tabsRow();
    expect(within(row).queryByText("UEFA Champions League")).toBeNull();

    act(() => report([{ isIntersecting: false, boundingClientRect: rect(-80, -10) }]));
    expect(within(row).getByText("UEFA Champions League")).toBeInTheDocument();
    // Still one h1: the copy is for the eye.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    act(() => report([{ isIntersecting: true, boundingClientRect: rect(120, 180) }]));
    expect(within(row).queryByText("UEFA Champions League")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("puts a new tab's top back under the bar when the bar is stuck", async () => {
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    renderShell();
    // Read 400px into the panel: its top is 296px above the bar's foot.
    place(104, -296);

    pick("Knockout");

    await waitFor(() => expect(scrollBy).toHaveBeenCalledWith({ top: -400 }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Bracket");
  });

  it("leaves the page where it is when the bar is not stuck", async () => {
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    renderShell();
    place(240, 240);

    pick("Knockout");

    await waitFor(() => expect(screen.getByRole("tabpanel")).toHaveTextContent("Bracket"));
    await Promise.resolve();
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("slides the tabs row, not the page, to a selected tab cut off at its edge", () => {
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    placeSideways([260, 340]);
    renderShell("knockout");
    const scroller = screen.getByRole("tablist").parentElement!;
    expect(scroller.scrollLeft).toBe(40);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("slides back to a selected tab that sits before the row's left edge", async () => {
    placeSideways([0, 80]);
    renderShell();
    const scroller = screen.getByRole("tablist").parentElement!;
    scroller.scrollLeft = 120;
    placeSideways([-60, 20]);

    pick("Knockout");

    await waitFor(() => expect(scroller.scrollLeft).toBe(60));
  });

  it("leaves the tabs row alone when the selected tab is in full view", () => {
    placeSideways([100, 180]);
    renderShell("knockout");
    expect(screen.getByRole("tablist").parentElement!.scrollLeft).toBe(0);
  });
});
