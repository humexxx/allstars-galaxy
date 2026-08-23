import {
  Anchor,
  Bed,
  Bus,
  Plane,
  ShoppingBag,
  Sparkles,
  Tag,
  Utensils,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { TripItemCategory } from "@/types/travel";

export type CategoryMeta = {
  value: TripItemCategory;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Tint for the icon chip. One theme token per category (see
   *  `app/globals.css`), so the dark step is chosen for the dark surface
   *  rather than bolted on with a `dark:` override — and so a hue can be
   *  retuned in one place. Deliberately NOT `--chart-1..5`: that palette is
   *  five slots that must never be cycled, and there are eight categories. */
  tint: string;
  /** The same hue as a solid fill, for where a chip will not fit — a calendar
   *  cell on a phone gets a dot and nothing else. */
  dot: string;
  /**
   * A calendar bar. Stronger than the chip's wash because it carries 10px
   * text across a pale cell.
   *
   * It used to go solid below `sm`, on the grounds that a bar with no room
   * for a label had only its colour to say anything. It carries a label at
   * every size now, so the soft wash is right everywhere: a name on a solid
   * amber or sky ground is a name nobody can read.
   *
   * Soft rather than a solid fill with white text: the lighter tokens
   * (amber at 3.19:1, lime at 3.06:1) do not clear AA for text on a solid
   * ground, and a badge nobody can read is not a badge. Deepening the wash
   * instead costs the same contrast — 15% leaves the label at 3.3:1 and 25%
   * drops it to 2.9 — so the edge does the work a darker fill would have
   * done, and the label keeps its contrast.
   */
  bar: string;
};

/**
 * Colour is the second channel, never the only one.
 *
 * The icon's shape is what actually says "flight"; the tint makes a long list
 * scannable and lets a row be recognised out of the corner of an eye. Anyone
 * who cannot separate two of these hues still reads a plane and a bed.
 *
 * Lives apart from the itinerary because the calendar needs it too, and
 * importing it from there dragged the whole server-action layer into a view
 * that only draws squares.
 */
export const CATEGORIES: CategoryMeta[] = [
  { value: "lodging", label: "Hotel", Icon: Bed,
    tint: "bg-trip-lodging/10 text-trip-lodging",
    dot: "bg-trip-lodging",
    bar: "bg-trip-lodging/15 text-trip-lodging ring-1 ring-trip-lodging/40 sm:hover:bg-trip-lodging/25" },
  { value: "flight", label: "Flight", Icon: Plane,
    tint: "bg-trip-flight/10 text-trip-flight",
    dot: "bg-trip-flight",
    bar: "bg-trip-flight/15 text-trip-flight ring-1 ring-trip-flight/40 sm:hover:bg-trip-flight/25" },
  { value: "cruise", label: "Cruise", Icon: Anchor,
    tint: "bg-trip-cruise/10 text-trip-cruise",
    dot: "bg-trip-cruise",
    bar: "bg-trip-cruise/15 text-trip-cruise ring-1 ring-trip-cruise/40 sm:hover:bg-trip-cruise/25" },
  { value: "transport", label: "Transport", Icon: Bus,
    tint: "bg-trip-transport/10 text-trip-transport",
    dot: "bg-trip-transport",
    bar: "bg-trip-transport/15 text-trip-transport ring-1 ring-trip-transport/40 sm:hover:bg-trip-transport/25" },
  { value: "food", label: "Food", Icon: Utensils,
    tint: "bg-trip-food/10 text-trip-food",
    dot: "bg-trip-food",
    bar: "bg-trip-food/15 text-trip-food ring-1 ring-trip-food/40 sm:hover:bg-trip-food/25" },
  { value: "activity", label: "Activity", Icon: Sparkles,
    tint: "bg-trip-activity/10 text-trip-activity",
    dot: "bg-trip-activity",
    bar: "bg-trip-activity/15 text-trip-activity ring-1 ring-trip-activity/40 sm:hover:bg-trip-activity/25" },
  { value: "shopping", label: "Shopping", Icon: ShoppingBag,
    tint: "bg-trip-shopping/10 text-trip-shopping",
    dot: "bg-trip-shopping",
    bar: "bg-trip-shopping/15 text-trip-shopping ring-1 ring-trip-shopping/40 sm:hover:bg-trip-shopping/25" },
  // Neutral on purpose: "other" is the absence of a category, and giving it a
  // hue of its own would make it look like one more kind of thing.
  { value: "other", label: "Other", Icon: Tag,
    tint: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    bar: "bg-muted text-muted-foreground ring-1 ring-border sm:hover:bg-muted-foreground/25" },
];

export function categoryMeta(c: TripItemCategory): CategoryMeta {
  return CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** One chip, so every view of an item agrees on what it looks like. */
export function CategoryIcon({
  category,
  className,
}: {
  category: TripItemCategory;
  className?: string;
}) {
  const { Icon, tint } = categoryMeta(category);
  return (
    <span
      className={cn("grid size-7 shrink-0 place-items-center rounded-md", tint, className)}
    >
      <Icon className="size-4" />
    </span>
  );
}
