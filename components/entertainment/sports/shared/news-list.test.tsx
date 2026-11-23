// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { NewsStory } from "@/types/sports";

vi.mock("next/image", () => ({
  default: ({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={onError} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { NewsList } from "./news-list";

const story = (id: string, headline: string, over: Partial<NewsStory> = {}): NewsStory => ({
  id,
  headline,
  description: null,
  href: `/news/f1/${id}`,
  external: false,
  image: null,
  at: "2026-10-24T04:36:05Z",
  kind: "story",
  about: [],
  ...over,
});

describe("NewsList", () => {
  it("leads with one story, sets two beside it and lists the rest under a heading of their own", () => {
    const image = { url: "https://cdn.example/a.jpg" };
    render(
      <NewsList
        lead={story("1", "Verstappen takes pole in Austin", { image })}
        items={[
          story("2", "Norris fastest in practice"),
          story("3", "Hamilton handed a grid penalty", { image }),
          story("4", "Leclerc to start from the back", { image }),
          story("5", "Alonso signs for 2027", { external: true, href: "https://www.espn.com/f1/5" }),
        ]}
      />
    );

    // The two set beside the lead are the first with a picture.
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Verstappen takes pole in Austin",
      "Hamilton handed a grid penalty",
      "Leclerc to start from the back",
      "More stories",
    ]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Norris fastest in practice",
      "Alonso signs for 2027",
    ]);
    expect(screen.getByRole("link", { name: /Norris fastest in practice/ })).toHaveAttribute(
      "href",
      "/news/f1/2"
    );
    // A story read at the source names it.
    expect(screen.getByRole("link", { name: /Alonso signs for 2027/ })).toHaveTextContent("espn.com");
  });

  it("lists ten stories after the two beside the lead, then ten more a tap", () => {
    const items = Array.from({ length: 25 }, (_, i) => story(`${i + 2}`, `Story ${i + 2}`));
    render(<NewsList lead={story("1", "The lead")} items={items} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Show 10 more" }));
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: "Show 3 more" }));
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(23);
  });

  it("has no button for a wire of ten or fewer", () => {
    render(<NewsList items={[story("1", "Only one")]} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("dates a story by month and day, without the year", () => {
    const { container } = render(<NewsList lead={story("1", "The lead")} items={[story("2", "Another")]} />);
    expect(screen.getAllByText(/^Oct 2[34]$/)).toHaveLength(2);
    expect(container).not.toHaveTextContent("2026");
  });

  it("leaves out a description that only repeats the headline", () => {
    render(
      <NewsList
        lead={story("1", "Game Highlights", { description: "Game Highlights" })}
        items={[
          story("2", "Norris fastest", { description: " Norris fastest " }),
          story("3", "Hamilton penalised", { description: "Five places for an engine change." }),
        ]}
      />
    );

    expect(screen.getAllByText("Game Highlights")).toHaveLength(1);
    expect(screen.getAllByText(/Norris fastest/)).toHaveLength(1);
    expect(screen.getByText("Five places for an engine change.")).toBeInTheDocument();
  });

  it("drops a picture that fails to load, leaving a text card", () => {
    const image = { url: "https://cdn.example/a.jpg" };
    const { container } = render(<NewsList items={[story("1", "With a picture", { image })]} />);

    const img = container.querySelector("img")!;
    expect(img).not.toBeNull();
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("heading", { name: "With a picture" })).toBeInTheDocument();
  });
});
