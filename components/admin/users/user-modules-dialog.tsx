"use client";

import { useState, useTransition } from "react";

import { setUserModuleAction } from "@/app/actions/admin-users";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Eyebrow, Text } from "@/components/ui/typography";
import { APP_MODULES, type AppModule } from "@/lib/access/modules";
import { runAction } from "@/lib/actions/run";
import type { UserListItem } from "@/types";

const AREAS = [...new Set(APP_MODULES.map((m) => m.area))];

/**
 * What one account may use. Each switch saves on its own: a module turned off
 * stays in that account's nav, greyed out, and its pages, actions and
 * assistant refuse the account from its next request.
 */
export function UserModulesDialog({
  user,
  onOpenChange,
}: {
  user: UserListItem | null;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {user && <ModuleSwitches key={user.id} user={user} />}
      </DialogContent>
    </Dialog>
  );
}

function ModuleSwitches({ user }: { user: UserListItem }): React.ReactElement {
  const [off, setOff] = useState<AppModule[]>(user.disabledModules);
  const [saving, setSaving] = useState<AppModule | null>(null);
  const [, startTransition] = useTransition();
  const name = user.fullName || user.email || "This account";

  const toggle = (module: AppModule, enabled: boolean): void => {
    const before = off;
    setOff(enabled ? off.filter((m) => m !== module) : [...off, module]);
    setSaving(module);
    startTransition(async () => {
      const label = APP_MODULES.find((m) => m.key === module)!.label;
      const result = await runAction(setUserModuleAction({ userId: user.id, module, enabled }), {
        success: `${label} ${enabled ? "on" : "off"} for ${name}`,
        failure: `Could not change ${label}`,
      });
      if (!result.ok) setOff(before);
      setSaving(null);
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Modules for {name}</DialogTitle>
        <DialogDescription>
          A module that is off stays in their menu, greyed out, and its pages cannot be opened.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        {AREAS.map((area) => (
          <div key={area} className="flex flex-col gap-2">
            <Eyebrow size="sm" as="div">
              {area}
            </Eyebrow>
            {APP_MODULES.filter((m) => m.area === area).map((m) => {
              const id = `module-${user.id}-${m.key}`;
              return (
                <div key={m.key} className="flex items-center justify-between gap-3">
                  <Text asChild variant="body">
                    <label htmlFor={id}>{m.label}</label>
                  </Text>
                  <Switch
                    id={id}
                    checked={!off.includes(m.key)}
                    disabled={saving === m.key}
                    onCheckedChange={(checked) => toggle(m.key, checked)}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
