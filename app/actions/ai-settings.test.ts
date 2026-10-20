import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/auth-server", () => ({ requireAdminCached: vi.fn() }));
vi.mock("@/lib/services/ai-service", () => ({ updateAiSettings: vi.fn() }));

import { revalidatePath } from "next/cache";
import { updateAiSettings } from "@/lib/services/ai-service";
import { requireAdminCached } from "@/lib/services/auth-server";

import { updateAiSettingsAction } from "./ai-settings";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.mocked(requireAdminCached).mockResolvedValue({ id: "admin-1" } as Awaited<
    ReturnType<typeof requireAdminCached>
  >);
});

describe("updateAiSettingsAction", () => {
  it("saves the model for an admin and refreshes the portal", async () => {
    vi.mocked(updateAiSettings).mockResolvedValue({ model: "claude-haiku-5-5", apiKeyExpiresOn: null });
    const result = await updateAiSettingsAction({ model: "claude-haiku-5-5" });
    expect(result).toEqual({ success: true, data: { model: "claude-haiku-5-5", apiKeyExpiresOn: null } });
    expect(updateAiSettings).toHaveBeenCalledWith("admin-1", { model: "claude-haiku-5-5" });
    expect(revalidatePath).toHaveBeenCalledWith("/portal", "layout");
  });

  it("refuses a model that is not on the list", async () => {
    const result = await updateAiSettingsAction({ model: "gpt-9" } as never);
    expect(result.success).toBe(false);
    expect(updateAiSettings).not.toHaveBeenCalled();
  });

  it("is closed to anybody who is not an admin", async () => {
    vi.mocked(requireAdminCached).mockRejectedValue(new Error("Forbidden: Admin access required"));
    expect(await updateAiSettingsAction({ apiKeyExpiresOn: "2027-10-19" })).toEqual({
      success: false,
      error: "Action failed",
    });
    expect(updateAiSettings).not.toHaveBeenCalled();
  });
});
