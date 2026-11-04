// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AiKeyExpiryNotice } from "./ai-key-expiry-notice";

beforeEach(() => window.localStorage.clear());

describe("AiKeyExpiryNotice", () => {
  it("warns once per stage, and remembers a dismissal", () => {
    const { unmount } = render(
      <AiKeyExpiryNotice warning={{ stage: "20", daysLeft: 18 }} expiresOn="2027-10-19" />
    );
    expect(screen.getByText("The Claude API key expires in 18 days")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(window.localStorage.getItem("ai-key-expiry-seen")).toBe("20");
    unmount();

    // Same stage: quiet. The next stage still comes.
    const again = render(<AiKeyExpiryNotice warning={{ stage: "20", daysLeft: 15 }} expiresOn="2027-10-19" />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    again.unmount();
    render(<AiKeyExpiryNotice warning={{ stage: "day:2027-10-12", daysLeft: 7 }} expiresOn="2027-10-19" />);
    expect(screen.getByText("The Claude API key expires in 7 days")).toBeInTheDocument();
  });

  it("says so plainly once the key has expired", () => {
    render(<AiKeyExpiryNotice warning={{ stage: "expired:2027-10-21", daysLeft: -2 }} expiresOn="2027-10-19" />);
    expect(screen.getByText("The Claude API key has expired")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a new key" })).toHaveAttribute(
      "href",
      "https://platform.claude.com/settings/keys"
    );
  });
});
