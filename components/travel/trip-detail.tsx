"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  DollarSign,
  ListChecks,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { deleteTripAction } from "@/app/actions/travel";
import type { TripWithRelations } from "@/types/travel";

import { TripForm } from "./trip-form";
import { TripItinerary } from "./trip-itinerary";
import { TripGallery } from "./trip-gallery";
import { TripSharePanel } from "./trip-share-panel";

function parseTripDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateRange(start: string, end: string | null): string {
  const s = parseTripDate(start);
  if (!end || start === end) return format(s, "EEE, MMM d, yyyy");
  const e = parseTripDate(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  if (sameYear) {
    return `${format(s, "EEE, MMM d")} – ${format(e, "EEE, MMM d, yyyy")}`;
  }
  return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
}

function tripDays(start: string, end: string | null): number {
  const s = parseTripDate(start);
  const e = end ? parseTripDate(end) : s;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

export function formatTripMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Unknown currency code falls back to plain number prefixed with code.
    return `${currency} ${value.toFixed(2)}`;
  }
}

type TripDetailProps = {
  trip: TripWithRelations;
  baseUrl: string;
};

export function TripDetail({ trip, baseUrl }: TripDetailProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  const totalEstimate = useMemo(
    () =>
      trip.items.reduce((sum, item) => {
        if (!item.price) return sum;
        const n = parseFloat(item.price);
        return Number.isFinite(n) ? sum + n : sum;
      }, 0),
    [trip.items]
  );

  const handleDelete = () => {
    startDelete(async () => {
      const res = await deleteTripAction(trip.id);
      if (res.success) {
        toast.success("Trip deleted");
        router.push("/portal/entertainment/travel-planner");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/portal/entertainment/travel-planner">
            <ArrowLeft className="mr-1 h-4 w-4" /> All trips
          </Link>
        </Button>
      </div>

      <header className="overflow-hidden rounded-xl border">
        <div
          className="relative aspect-[21/9] w-full bg-muted"
          style={trip.coverPhotoUrl ? undefined : { backgroundColor: trip.color }}
        >
          {trip.coverPhotoUrl && (
            <Image
              src={trip.coverPhotoUrl}
              alt={`${trip.title} cover photo`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 text-white">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{trip.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
              {trip.destination && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {trip.destination}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                <Mono>{formatDateRange(trip.startDate, trip.endDate)}</Mono>
              </span>
            </div>
          </div>
          <div className="absolute right-4 top-4 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-destructive/90 text-destructive-foreground hover:bg-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={CalendarDays}
          label="Duration"
          value={`${tripDays(trip.startDate, trip.endDate)} day${tripDays(trip.startDate, trip.endDate) === 1 ? "" : "s"}`}
        />
        <StatCard icon={ListChecks} label="Items" value={String(trip.items.length)} />
        <StatCard
          icon={DollarSign}
          label="Est. total"
          value={formatTripMoney(totalEstimate, trip.currency)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <TripItinerary trip={trip} />
        </div>
        <div className="space-y-6">
          <TripGallery trip={trip} />
          <TripSharePanel trip={trip} baseUrl={baseUrl} />
        </div>
      </div>

      {trip.description && (
        <Card>
          <CardContent className="p-5">
            <Eyebrow className="mb-2 block">About this trip</Eyebrow>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{trip.description}</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit trip</DialogTitle>
            <DialogDescription>
              Update the basics, dates, or cover photo. Items and photos stay where they are.
            </DialogDescription>
          </DialogHeader>
          <Suspense>
            <TripForm trip={trip} />
          </Suspense>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{trip.title}</strong> and all its items, photos and share links will be
              permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className={cn("flex items-center gap-3 p-4")}>
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
