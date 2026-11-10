"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { SettingRow } from "@/components/settings/settings-shell";
import { FinanceScene } from "@/components/portal/mascot/finance-scene";
import type { UserPreferences } from "@/types/preferences";

import { setShowContextAvatarAction } from "@/app/actions/user-preferences";

type AppearanceSettingsProps = {
  preferences: UserPreferences;
};

export function AppearanceSettings({ preferences }: AppearanceSettingsProps) {
  const [showAvatar, setShowAvatar] = useState(preferences.showContextAvatar);
  const [isPending, setIsPending] = useState(false);

  async function handleToggle(next: boolean): Promise<void> {
    // Ignored rather than `disabled` while a save is in flight: disabling
    // the focused switch drops keyboard focus to the page.
    if (isPending) return;
    // Optimistic — flip immediately, revert if the action fails.
    setShowAvatar(next);
    setIsPending(true);
    const result = await setShowContextAvatarAction({ showContextAvatar: next }).catch(
      () => ({ success: false as const, error: "Failed to save the setting" })
    );
    setIsPending(false);
    // No refresh on success: the action revalidates the pages that read it.
    if (!result.success) {
      setShowAvatar(!next);
      toast.error(result.error);
    }
  }

  return (
    <SettingRow
      label="Module mascot"
      description="Show a small animated character at the bottom of module pages: mining gold on Plans, playing the sport on screen on Sports, planning a trip on Travel."
      control={
        <div className="flex items-center gap-2">
          {isPending && <Spinner className="size-3.5 text-muted-foreground" />}
          <Switch
            checked={showAvatar}
            aria-disabled={isPending}
            aria-busy={isPending}
            onCheckedChange={handleToggle}
            aria-label="Toggle module mascot"
          />
        </div>
      }
    >
      {showAvatar && <FinanceScene mood="steady" />}
    </SettingRow>
  );
}
