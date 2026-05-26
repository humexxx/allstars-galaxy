"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

export type DevToolHelper =
  | {
      id: string;
      kind: "toggle";
      label: string;
      description?: string;
      section?: string;
      checked: boolean;
      onChange: (next: boolean) => void;
    }
  | {
      id: string;
      kind: "action";
      label: string;
      description?: string;
      section?: string;
      icon?: LucideIcon;
      variant?: "default" | "destructive";
      onRun: () => void | Promise<void>;
    }
  | {
      id: string;
      kind: "custom";
      section?: string;
      render: () => React.ReactNode;
    };

// Stable: only contains setters/handlers that never change identity. Consumers
// using `useRegisterDevTool` depend on this context so their effects don't
// re-fire every time another component registers a new helper.
type DevToolsCommandsContextValue = {
  register: (helper: DevToolHelper) => void;
  unregister: (id: string) => void;
  setOpen: (open: boolean) => void;
};

// Changing: re-renders whenever helpers are added/removed or the drawer
// open state flips. Only the drawer itself reads this.
type DevToolsStateContextValue = {
  helpers: DevToolHelper[];
  open: boolean;
};

const DevToolsCommandsContext =
  React.createContext<DevToolsCommandsContextValue | null>(null);
const DevToolsStateContext = React.createContext<DevToolsStateContextValue | null>(
  null
);

export function DevToolsProvider({ children }: { children: React.ReactNode }) {
  const [helpersById, setHelpersById] = React.useState<Map<string, DevToolHelper>>(
    () => new Map()
  );
  const [open, setOpen] = React.useState(false);

  // `useCallback` with empty deps + functional `setState` keeps these
  // referentially stable for the lifetime of the provider.
  const register = React.useCallback((helper: DevToolHelper) => {
    setHelpersById((prev) => {
      const next = new Map(prev);
      next.set(helper.id, helper);
      return next;
    });
  }, []);

  const unregister = React.useCallback((id: string) => {
    setHelpersById((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const commands = React.useMemo<DevToolsCommandsContextValue>(
    () => ({ register, unregister, setOpen }),
    [register, unregister]
  );

  const helpers = React.useMemo(
    () => Array.from(helpersById.values()),
    [helpersById]
  );

  const state = React.useMemo<DevToolsStateContextValue>(
    () => ({ helpers, open }),
    [helpers, open]
  );

  return (
    <DevToolsCommandsContext.Provider value={commands}>
      <DevToolsStateContext.Provider value={state}>
        {children}
      </DevToolsStateContext.Provider>
    </DevToolsCommandsContext.Provider>
  );
}

export function useDevToolsState(): DevToolsStateContextValue | null {
  return React.useContext(DevToolsStateContext);
}

export function useDevToolsCommands(): DevToolsCommandsContextValue | null {
  return React.useContext(DevToolsCommandsContext);
}

/**
 * Pages call this once per helper they want to expose in the dev drawer.
 * Re-registers on every change to the helper config (object identity), so it
 * is the caller's job to memoise the helper if the contents are stable.
 *
 * Safe to call when the provider isn't mounted (e.g. outside /portal) — the
 * helper is silently dropped instead of throwing.
 */
export function useRegisterDevTool(helper: DevToolHelper | null): void {
  const commands = useDevToolsCommands();

  React.useEffect(() => {
    if (!commands || !helper) return;
    commands.register(helper);
    return () => commands.unregister(helper.id);
  }, [commands, helper]);
}
