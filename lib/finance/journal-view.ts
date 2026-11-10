/** The trading journal's views. The URL's `?view=` names one. */
export const JOURNAL_VIEWS = ["calendar", "analytics", "trades"] as const;
export type JournalView = (typeof JOURNAL_VIEWS)[number];

export const DEFAULT_JOURNAL_VIEW: JournalView = "calendar";

/** `?view=` read back: anything but a known view (absent, repeated, a typo) is the default. */
export function parseJournalView(value: string | string[] | undefined): JournalView {
  return JOURNAL_VIEWS.find((v) => v === value) ?? DEFAULT_JOURNAL_VIEW;
}

/** The current address with `?view=` set to `view`, or dropped for the default. */
export function hrefWithJournalView(href: string, view: JournalView): string {
  const url = new URL(href);
  if (view === DEFAULT_JOURNAL_VIEW) url.searchParams.delete("view");
  else url.searchParams.set("view", view);
  return `${url.pathname}${url.search}${url.hash}`;
}
