/** The Overview switcher's views, in swipe order. The URL's `?view=` names one. */
export const PLAN_VIEWS = ["chart", "table", "calendar"] as const;
export type PlanView = (typeof PLAN_VIEWS)[number];

export const DEFAULT_PLAN_VIEW: PlanView = "chart";

/** `?view=` read back: anything but a known view (absent, repeated, a typo) is the default. */
export function parsePlanView(value: string | string[] | undefined): PlanView {
  return PLAN_VIEWS.find((v) => v === value) ?? DEFAULT_PLAN_VIEW;
}

/** The current address with `?view=` set to `view`, or dropped for the default. */
export function hrefWithPlanView(href: string, view: PlanView): string {
  const url = new URL(href);
  if (view === DEFAULT_PLAN_VIEW) url.searchParams.delete("view");
  else url.searchParams.set("view", view);
  return `${url.pathname}${url.search}${url.hash}`;
}
