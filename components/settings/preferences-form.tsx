"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ContextAvatar } from "@/components/portal/context-avatar";
import type { UserPreferences } from "@/lib/services/user-preferences-service";

import { setShowContextAvatarAction } from "@/app/actions/user-preferences";

type PreferencesFormProps = {
  preferences: UserPreferences;
};

export function PreferencesForm({ preferences }: PreferencesFormProps) {
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
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Personalize how the portal looks and feels.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Module mascot</div>
            <div className="text-xs text-muted-foreground">
              Show a small animated mascot at the bottom of module pages — on
              Finance it mines for gold.
            </div>
          </div>
          {isPending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          <Switch
            checked={showAvatar}
            disabled={isPending}
            onCheckedChange={handleToggle}
            aria-label="Toggle module mascot"
          />
        </div>
        {showAvatar && <ContextAvatar variant="finance" className="pt-6" />}
      </CardContent>
    </Card>
  );
}
