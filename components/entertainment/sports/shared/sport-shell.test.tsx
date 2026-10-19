// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SportShell } from "./sport-shell";

function renderShell(): ReturnType<typeof render> {
  return render(
    <Tabs defaultValue="overview">
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
        <TabsContent value="overview">Matches</TabsContent>
        <TabsContent value="knockout">Bracket</TabsContent>
      </SportShell>
    </Tabs>
  );
}

const rect = (top: number, bottom: number): DOMRect =>
  ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top }) as DOMRect;

/** The tabs row reaches `barBottom`; the panel's box starts at `contentTop`. */
function place(barBottom: number, contentTop: number): void {
  const tabsRow = screen.getByRole("tablist").parentElement!;
  const content = screen.getByRole("tabpanel").parentElement!;
  vi.spyOn(tabsRow, "getBoundingClientRect").mockReturnValue(rect(barBottom - 48, barBottom));
  vi.spyOn(content, "getBoundingClientRect").mockReturnValue(rect(contentTop, contentTop + 2000));
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

  it("keeps the tabs in a sticky row that clears the app header on a phone", () => {
    renderShell();
    const tabsRow = screen.getByRole("tablist").parentElement!;
    expect(tabsRow).toHaveClass("sticky", "top-14", "md:top-0", "bg-background");
    // From @4xl the whole header row is the sticky bar instead.
    expect(tabsRow.parentElement).toHaveClass("@4xl:sticky", "@4xl:top-0", "contents");
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
});
