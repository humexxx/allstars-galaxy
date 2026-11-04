/**
 * The dashboard's section and card grid, shared by the page and its
 * `loading.tsx` so the two cannot drift apart. The skeleton once split into
 * two columns at `md:` while the page split at `@xl:`, and drew a card the
 * page does not have: every load ended in a jump.
 *
 * Two columns once the content itself is wide enough, not the viewport: from
 * `lg` the sidebar takes 192px, so at 1024px the content is ~736px, less a
 * Windows scrollbar — narrower than at 900px, where there is no sidebar. The
 * step sits on the content's width (`@xl`, 576px). Finance and travel span
 * both columns; each favourite sport gets a card at half the row.
 */
export const DASHBOARD_SECTION = "@container flex flex-col gap-6";
export const DASHBOARD_GRID = "grid auto-rows-min gap-4 @xl:grid-cols-2";
