/**
 * The product modules an admin can turn off for one account. A module that is
 * off stays in that account's nav, greyed out, and its pages, actions and
 * assistant refuse the account; its dashboard card is not drawn and the plans
 * leave its money out. Everyone starts with every module on: what is stored
 * is the list of modules turned OFF (`users.disabled_modules`), so a module
 * added here later is on for everyone until an admin says otherwise.
 */
export const APP_MODULES = [
  { key: "plans", label: "Plans", area: "Finance", url: "/portal/plans" },
  { key: "portfolio", label: "Portfolio", area: "Finance", url: "/portal/portfolio" },
  { key: "trading", label: "Trading Journal", area: "Finance", url: "/portal/trading" },
  { key: "board", label: "Board", area: "Productivity", url: "/portal/productivity/board" },
  { key: "road-paths", label: "Road Paths", area: "Productivity", url: "/portal/productivity/road-paths" },
  { key: "travel", label: "Travel Planner", area: "Entertainment", url: "/portal/entertainment/travel-planner" },
  { key: "sports", label: "Sports", area: "Entertainment", url: "/portal/entertainment/sports" },
] as const;

export type AppModule = (typeof APP_MODULES)[number]["key"];

export const APP_MODULE_KEYS = APP_MODULES.map((m) => m.key) as [AppModule, ...AppModule[]];

export function isAppModule(value: string): value is AppModule {
  return APP_MODULE_KEYS.includes(value as AppModule);
}

/** The module a portal address belongs to, or null (the dashboard, settings, admin). */
export function moduleOfPath(pathname: string): AppModule | null {
  return APP_MODULES.find((m) => pathname === m.url || pathname.startsWith(`${m.url}/`))?.key ?? null;
}

export function moduleLabel(module: AppModule): string {
  return APP_MODULES.find((m) => m.key === module)!.label;
}

/** Stored values read back: anything that is no longer a module is dropped. */
export function parseDisabledModules(value: readonly string[] | null | undefined): AppModule[] {
  return (value ?? []).filter(isAppModule);
}
