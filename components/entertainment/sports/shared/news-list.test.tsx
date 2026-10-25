// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { NewsStory } from "@/types/sports";

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { NewsList } from "./news-list";

const story = (id: string, headline: string): NewsStory => ({
  id,
  headline,
  description: null,
  href: `/news/f1/${id}`,
  external: false,
  image: null,
  at: "2026-10-24T04:36:05Z",
  kind: "story",
  about: [],
});

describe("NewsList", () => {
  it("makes every story a heading under the sport's h1, the lead at the same level as the rest", () => {
    render(
      <NewsList
        lead={story("1", "Verstappen takes pole in Austin")}
        items={[story("2", "Norris fastest in practice"), story("3", "Hamilton handed a grid penalty")]}
      />
    );

    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Verstappen takes pole in Austin",
      "Norris fastest in practice",
      "Hamilton handed a grid penalty",
    ]);
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
    expect(screen.getByRole("link", { name: /Norris fastest in practice/ })).toHaveAttribute(
      "href",
      "/news/f1/2"
    );
  });
});
