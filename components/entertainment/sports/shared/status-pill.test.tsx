// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPill } from "./status-pill";

describe("StatusPill", () => {
  it("sets a live pill's words in the foreground, its green on the tint and the dot", () => {
    render(<StatusPill status="live" />);
    const pill = screen.getByText("Live");
    expect(pill).toHaveAttribute("data-variant", "success");
    expect(pill).toHaveClass("text-foreground");
    expect(pill).not.toHaveClass("text-success");
    expect(pill.querySelector("[aria-hidden]")).toHaveClass("bg-success");
  });

  it("keeps an upcoming pill's blue on the tint, not the words", () => {
    render(<StatusPill status="upcoming" />);
    const pill = screen.getByText("Upcoming");
    expect(pill).toHaveAttribute("data-variant", "info");
    expect(pill).toHaveClass("text-foreground");
    expect(pill).not.toHaveClass("text-primary");
  });
});
