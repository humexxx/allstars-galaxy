// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShareCta } from "./share-cta";

const hrefs = (): (string | null)[] =>
  screen.getAllByRole("link").map((a) => a.getAttribute("href"));

describe("ShareCta", () => {
  it("invites the recipient in under the address the link was made for", () => {
    render(
      <ShareCta
        inviteeEmail="ana@example.com"
        currentUserEmail={null}
        shareToken="tok"
        signupsOpen
      />
    );

    expect(hrefs()).toEqual([
      "/login?next=%2Ftrips%2Ftok",
      "/signup?email=ana%40example.com&next=%2Ftrips%2Ftok",
    ]);
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("offers only the way back in while signups are closed", () => {
    // A sign-up button would land on the closed notice, and the invitation
    // label only exists to prefill that sign-up.
    render(
      <ShareCta
        inviteeEmail="ana@example.com"
        currentUserEmail={null}
        shareToken="tok"
        signupsOpen={false}
      />
    );

    expect(hrefs()).toEqual(["/login?next=%2Ftrips%2Ftok"]);
    expect(screen.queryByText("ana@example.com")).toBeNull();
  });

  it("points somebody already signed in at their own trips", () => {
    render(
      <ShareCta
        inviteeEmail={null}
        currentUserEmail="jason@example.com"
        shareToken="tok"
        signupsOpen={false}
      />
    );

    expect(hrefs()).toEqual(["/portal/entertainment/travel-planner"]);
  });
});
