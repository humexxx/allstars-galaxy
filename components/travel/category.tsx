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
    dot: "bg-trip-lodging" },
  { value: "flight", label: "Flight", Icon: Plane,
    tint: "bg-trip-flight/10 text-trip-flight",
    dot: "bg-trip-flight" },
  { value: "cruise", label: "Cruise", Icon: Anchor,
    tint: "bg-trip-cruise/10 text-trip-cruise",
    dot: "bg-trip-cruise" },
  { value: "transport", label: "Transport", Icon: Bus,
    tint: "bg-trip-transport/10 text-trip-transport",
    dot: "bg-trip-transport" },
  { value: "food", label: "Food", Icon: Utensils,
    tint: "bg-trip-food/10 text-trip-food",
    dot: "bg-trip-food" },
  { value: "activity", label: "Activity", Icon: Sparkles,
    tint: "bg-trip-activity/10 text-trip-activity",
    dot: "bg-trip-activity" },
  { value: "shopping", label: "Shopping", Icon: ShoppingBag,
    tint: "bg-trip-shopping/10 text-trip-shopping",
    dot: "bg-trip-shopping" },
  // Neutral on purpose: "other" is the absence of a category, and giving it a
  // hue of its own would make it look like one more kind of thing.
  { value: "other", label: "Other", Icon: Tag,
    tint: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground" },
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
