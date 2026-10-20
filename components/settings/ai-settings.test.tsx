// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/ai-settings", () => ({ updateAiSettingsAction: vi.fn() }));
vi.mock("@/app/actions/user-preferences", () => ({ setShowContextAvatarAction: vi.fn() }));
vi.mock("@/components/settings/milestones-form", () => ({ FinanceSettings: () => null }));
vi.mock("@/components/portal/context-avatar", () => ({ ContextAvatar: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { updateAiSettingsAction } from "@/app/actions/ai-settings";
import type { UserPreferences } from "@/types/preferences";

import { AiSettingsPane } from "./ai-settings";
import { SettingsShell, type AiPaneData } from "./settings-shell";

const AI: AiPaneData = {
  settings: { model: "claude-opus-5-5", apiKeyExpiresOn: "2027-10-19" },
  usage: {
    today: { costUsd: 0.07, requests: 4 },
    months: [
      { month: "2026-10", costUsd: 12.345, requests: 120 },
      { month: "2026-09", costUsd: 3.5, requests: 40 },
    ],
  },
  keyConfigured: true,
  today: "2026-10-19",
};

const PREFS = { showContextAvatar: true, financeMilestones: null } as unknown as UserPreferences;

beforeEach(() => vi.clearAllMocks());

describe("AiSettingsPane", () => {
  it("shows this month's spend against the monthly credit", () => {
    render(<AiSettingsPane {...AI} />);
    expect(screen.getByText("October 2026")).toBeInTheDocument();
    expect(screen.getByText("$12.35")).toBeInTheDocument();
    expect(screen.getByText("of $100.00 · $87.66 left")).toBeInTheDocument();
    expect(screen.getByText(/Today \$0\.07 · 120 calls this month · renews Nov 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(screen.getByText("365 days left")).toBeInTheDocument();
  });

  it("clears the expiry date and saves that there is none", async () => {
    vi.mocked(updateAiSettingsAction).mockResolvedValue({
      success: true,
      data: { model: "claude-opus-5-5", apiKeyExpiresOn: null },
    });
    render(<AiSettingsPane {...AI} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    });
    expect(updateAiSettingsAction).toHaveBeenCalledWith({ apiKeyExpiresOn: null });
  });

  it("says when the server has no key", () => {
    render(<AiSettingsPane {...AI} keyConfigured={false} />);
    expect(screen.getByText("Missing")).toBeInTheDocument();
  });
});

describe("SettingsShell", () => {
  it("has an AI category for admins only", () => {
    const { unmount } = render(<SettingsShell preferences={PREFS} />);
    expect(screen.queryByRole("tab", { name: "AI" })).toBeNull();
    unmount();
    render(<SettingsShell preferences={PREFS} ai={AI} />);
    expect(screen.getByRole("tab", { name: "AI" })).toBeInTheDocument();
  });
});
