"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Bed,
  ExternalLink,
  Pencil,
  Plane,
  Plus,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import {
  addTripItemAction,
  deleteTripItemAction,
  updateTripItemAction,
} from "@/app/actions/travel";
import type { TripItem, TripItemCategory, TripWithRelations } from "@/types/travel";

import { formatTripMoney } from "./trip-detail";

const CATEGORIES: { value: TripItemCategory; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "lodging", label: "Lodging", Icon: Bed },
  { value: "transport", label: "Transport", Icon: Plane },
  { value: "food", label: "Food", Icon: Utensils },
  { value: "activity", label: "Activity", Icon: Sparkles },
  { value: "shopping", label: "Shopping", Icon: ShoppingBag },
  { value: "other", label: "Other", Icon: Tag },
];

function categoryMeta(c: TripItemCategory) {
  return CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[CATEGORIES.length - 1];
}

const NO_DATE_KEY = "__no_date__";

function groupByDay(items: TripItem[]): Array<{ key: string; label: string; items: TripItem[]; total: number }> {
  const groups = new Map<string, TripItem[]>();
  for (const item of items) {
    const key = item.scheduledOn ?? NO_DATE_KEY;
    const arr = groups.get(key);
    if (arr) arr.push(item);
    else groups.set(key, [item]);
  }
  // Real dates first (ascending), unscheduled bucket last.
  const dateKeys = [...groups.keys()].filter((k) => k !== NO_DATE_KEY).sort();
  if (groups.has(NO_DATE_KEY)) dateKeys.push(NO_DATE_KEY);
  return dateKeys.map((key) => {
    const arr = groups.get(key)!;
    const total = arr.reduce((sum, it) => {
      if (!it.price) return sum;
      const n = parseFloat(it.price);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);
    const label =
      key === NO_DATE_KEY
        ? "Unscheduled"
        : format(parseDate(key), "EEEE, MMM d");
    return { key, label, items: arr, total };
  });
}

function parseDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

type TripItineraryProps = {
  trip: TripWithRelations;
};

export function TripItinerary({ trip }: TripItineraryProps) {
  const [adding, setAdding] = useState(false);
  const groups = useMemo(() => groupByDay(trip.items), [trip.items]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Itinerary</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          {adding ? <X className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
          {adding ? "Cancel" : "Add item"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {adding && (
          <ItemForm
            tripId={trip.id}
            defaultDate={trip.startDate}
            onDone={() => setAdding(false)}
          />
        )}

        {groups.length === 0 && !adding && (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No items yet. Add lodging, transport, activities or anything with a link or price.
          </p>
        )}

        {groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <div className="flex items-end justify-between border-b pb-1">
              <h3 className="text-sm font-semibold tracking-tight">{group.label}</h3>
              {group.total > 0 && (
                <Mono className="text-xs text-muted-foreground">
                  {formatTripMoney(group.total, trip.currency)}
                </Mono>
              )}
            </div>
            <ul className="divide-y">
              {group.items.map((item) => (
                <ItemRow key={item.id} tripId={trip.id} item={item} currency={trip.currency} />
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function ItemRow({
  tripId,
  item,
  currency,
}: {
  tripId: string;
  item: TripItem;
  currency: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const meta = categoryMeta(item.category);
  const Icon = meta.Icon;

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteTripItemAction(tripId, item.id);
      if (res.success) {
        toast.success("Item removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  if (editing) {
    return (
      <li className="py-3">
        <ItemForm
          tripId={tripId}
          item={item}
          defaultDate={item.scheduledOn}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-3 py-3">
      <div className="rounded-md bg-muted p-1.5 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">{item.title}</p>
          {item.price && (
            <Mono className="text-xs font-medium">
              {formatTripMoney(parseFloat(item.price), currency)}
            </Mono>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="capitalize">{meta.label}</span>
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Link
            </a>
          )}
        </div>
        {item.notes && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{item.notes}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setEditing(true)}
          aria-label="Edit item"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          disabled={isPending}
          onClick={handleDelete}
          aria-label="Delete item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

function ItemForm({
  tripId,
  item,
  defaultDate,
  onDone,
}: {
  tripId: string;
  item?: TripItem;
  defaultDate?: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(item?.title ?? "");
  const [category, setCategory] = useState<TripItemCategory>(item?.category ?? "activity");
  const [link, setLink] = useState(item?.link ?? "");
  const [price, setPrice] = useState(item?.price ?? "");
  const [scheduledOn, setScheduledOn] = useState(item?.scheduledOn ?? defaultDate ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Item needs a title");
      return;
    }
    if (price && !/^\d+(\.\d{1,2})?$/.test(price)) {
      toast.error("Price must be a non-negative number with up to 2 decimals");
      return;
    }

    startTransition(async () => {
      const payload = {
        title: title.trim(),
        category,
        link: link.trim() || null,
        price: price.trim() || null,
        scheduledOn: scheduledOn || null,
        notes: notes.trim() || null,
      };
      const res = item
        ? await updateTripItemAction(tripId, { id: item.id, ...payload })
        : await addTripItemAction(tripId, payload);
      if (res.success) {
        toast.success(item ? "Item updated" : "Item added");
        router.refresh();
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "space-y-3 rounded-md border bg-muted/30 p-3",
        !item && "border-primary/30"
      )}
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`title-${item?.id ?? "new"}`} className="text-xs">Title</Label>
          <Input
            id={`title-${item?.id ?? "new"}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Check-in at Hotel Bairro Alto"
            required
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as TripItemCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(({ value, label, Icon }) => (
                <SelectItem key={value} value={value}>
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`date-${item?.id ?? "new"}`} className="text-xs">Day</Label>
          <Input
            id={`date-${item?.id ?? "new"}`}
            type="date"
            value={scheduledOn ?? ""}
            onChange={(e) => setScheduledOn(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`price-${item?.id ?? "new"}`} className="text-xs">Price</Label>
          <Input
            id={`price-${item?.id ?? "new"}`}
            inputMode="decimal"
            value={price ?? ""}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`link-${item?.id ?? "new"}`} className="text-xs">Link</Label>
          <Input
            id={`link-${item?.id ?? "new"}`}
            type="url"
            value={link ?? ""}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://booking.com/…"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${item?.id ?? "new"}`} className="text-xs">Notes</Label>
        <Textarea
          id={`notes-${item?.id ?? "new"}`}
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reservation reference, confirmation code, who's coming…"
          rows={2}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : item ? "Save" : "Add item"}
        </Button>
      </div>
    </form>
  );
}
