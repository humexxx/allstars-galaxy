"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { SettingRow } from "@/components/settings/settings-shell";
import { ContextAvatar } from "@/components/portal/context-avatar";
import type { UserPreferences } from "@/lib/services/user-preferences-service";

import { setShowContextAvatarAction } from "@/app/actions/user-preferences";

type AppearanceSettingsProps = {
  preferences: UserPreferences;
};

export function AppearanceSettings({ preferences }: AppearanceSettingsProps) {
  const router = useRouter();
  const [showAvatar, setShowAvatar] = useState(preferences.showContextAvatar);
  const [isPending, setIsPending] = useState(false);
  const [, startTransition] = useTransition();

  async function handleToggle(next: boolean) {
    // Optimistic — flip immediately, revert if the action fails.
    setShowAvatar(next);
    setIsPending(true);
    const result = await setShowContextAvatarAction({
      showContextAvatar: next,
    });
    setIsPending(false);
    if (!result.success) {
      setShowAvatar(!next);
      toast.error(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <SettingRow
      label="Module mascot"
      description="Show a small animated mascot at the bottom of module pages — on Finance it mines for gold."
      control={
        <div className="flex items-center gap-2">
          {isPending && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
          <Switch
            checked={showAvatar}
            disabled={isPending}
            onCheckedChange={handleToggle}
            aria-label="Toggle module mascot"
          />
        </div>
      }
    >
      {showAvatar && <ContextAvatar variant="finance" />}
    </SettingRow>
  );
}
