// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LandingPage from "@/app/page";

// The real module imports `server-only`, which the jsdom transform cannot
// resolve; the page only needs its answer.
const { signupsAllowed } = vi.hoisted(() => ({ signupsAllowed: vi.fn<() => boolean>() }));
vi.mock("@/lib/auth/signups", () => ({ signupsAllowed }));

// Renders the whole page with the mobile menu open, so every call to action
// on it — nav, hero, closing section, footer — is in the DOM.
function renderLanding(): HTMLElement {
  const { container } = render(<LandingPage />);
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  return container;
}

function signupLinks(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('a[href="/signup"]'));
}

describe("LandingPage calls to action", () => {
  it("sends nobody to the closed signup page while signups are off", () => {
    signupsAllowed.mockReturnValue(false);
    const container = renderLanding();

    expect(signupLinks(container)).toHaveLength(0);
    expect(screen.queryByText(/free during beta/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /log in/i }).length).toBeGreaterThan(0);
  });

  it("offers signup everywhere while signups are open", () => {
    signupsAllowed.mockReturnValue(true);
    const container = renderLanding();

    // Desktop nav, mobile menu, hero, closing section and footer.
    expect(signupLinks(container)).toHaveLength(5);
    expect(screen.getByText(/free during beta/i)).toBeInTheDocument();
  });
});
