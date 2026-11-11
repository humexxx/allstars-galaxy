"use client";

import { useState } from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { toast } from "sonner";

import { RadioGroup } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { SettingRow } from "@/components/settings/settings-shell";
import { HeroPortrait } from "@/components/portal/mascot/characters";
import { FinanceScene } from "@/components/portal/mascot/finance-scene";
import {
  MASCOT_CHARACTERS,
  MASCOT_CHARACTER_LABELS,
  type MascotCharacter,
  type UserPreferences,
} from "@/types/preferences";

import { setMascotCharacterAction, setShowContextAvatarAction } from "@/app/actions/user-preferences";

type AppearanceSettingsProps = {
  preferences: UserPreferences;
};

export function AppearanceSettings({ preferences }: AppearanceSettingsProps) {
  const [showAvatar, setShowAvatar] = useState(preferences.showContextAvatar);
  const [character, setCharacter] = useState(preferences.mascotCharacter);
  const [isPending, setIsPending] = useState(false);
  const [isSavingCharacter, setIsSavingCharacter] = useState(false);

  async function handleCharacter(next: MascotCharacter): Promise<void> {
    if (isSavingCharacter || next === character) return;
    const previous = character;
    setCharacter(next);
    setIsSavingCharacter(true);
    const result = await setMascotCharacterAction({ mascotCharacter: next }).catch(
      () => ({ success: false as const, error: "Failed to save the character" })
    );
    setIsSavingCharacter(false);
    if (!result.success) {
      setCharacter(previous);
      toast.error(result.error);
    }
  }

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
    <>
      <SettingRow
        label="Module mascot"
        description="Show a small animated character at the bottom of module pages, doing whatever the page is about: mining gold on Plans, playing the sport on screen on Sports, moving a card to Done on the Board."
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
      />
      {showAvatar && (
        <SettingRow
          label="Character"
          description="Who plays every scene."
          control={isSavingCharacter ? <Spinner className="size-3.5 text-muted-foreground" /> : undefined}
        >
          <RadioGroup
            value={character}
            onValueChange={(next) => handleCharacter(next as MascotCharacter)}
            aria-label="Mascot character"
            aria-busy={isSavingCharacter}
            className="grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9"
          >
            {MASCOT_CHARACTERS.map((id) => (
              <RadioGroupPrimitive.Item
                key={id}
                value={id}
                className="flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-2 outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-checked:border-primary aria-checked:bg-primary/10"
              >
                <HeroPortrait character={id} className="ctxa h-14 w-auto" />
                <span className="w-full truncate text-xs text-muted-foreground">{MASCOT_CHARACTER_LABELS[id]}</span>
              </RadioGroupPrimitive.Item>
            ))}
          </RadioGroup>
          <FinanceScene mood="steady" character={character} />
        </SettingRow>
      )}
    </>
  );
}
