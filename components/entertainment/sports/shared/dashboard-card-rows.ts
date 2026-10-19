/**
 * The rows every sport card on the dashboard is cut into — header, lead box,
 * middle section, bottom section — and the grid they share.
 *
 * Two cards side by side take one set of row tracks between them (CSS
 * subgrid), so each section is as tall as the taller of the pair and the
 * lead boxes, lists and tables line up across the row whatever each sport
 * puts in them. A card always renders all four rows, empty or not, or the
 * next one would take its place. One column wide, a card is a plain stack.
 */
export const SPORT_CARD_ROWS = "gap-3 @xl:row-span-4 @xl:grid @xl:grid-rows-subgrid";

/** The header's own gap below it: the rows above meet at `gap-3`, it at 24px. */
export const SPORT_CARD_HEADER = "pb-3";

/** One of the three body rows. */
export const SPORT_CARD_SECTION = "flex min-w-0 flex-col gap-3 px-6";
