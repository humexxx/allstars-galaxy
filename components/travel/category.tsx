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
  /** Tint for the icon chip: a wash plus a foreground that holds up in both
   *  themes. Deliberately NOT `--chart-1..5` — that palette has five slots and
   *  must never be cycled, and there are eight categories here. */
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
    tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500" },
  { value: "flight", label: "Flight", Icon: Plane,
    tint: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500" },
  { value: "cruise", label: "Cruise", Icon: Anchor,
    tint: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    dot: "bg-teal-500" },
  { value: "transport", label: "Transport", Icon: Bus,
    tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    dot: "bg-violet-500" },
  { value: "food", label: "Food", Icon: Utensils,
    tint: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500" },
  // Lime, not the obvious emerald: emerald sits 22° from teal, and measured
  // ΔEok 0.056 against it — visible, but the tightest pair on the wheel. Lime
  // drops into the wide gap between amber and teal and takes the worst pair to
  // 0.137. The 700 step rather than 600 because lime is intrinsically light:
  // 600 clears non-text contrast at only 3.06:1, 700 at 4.96:1.
  { value: "activity", label: "Activity", Icon: Sparkles,
    tint: "bg-lime-500/10 text-lime-700 dark:text-lime-400",
    dot: "bg-lime-600" },
  { value: "shopping", label: "Shopping", Icon: ShoppingBag,
    tint: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    dot: "bg-fuchsia-500" },
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
