"use client";

import { useState, type ReactNode } from "react";
import { CalendarDays, List as ListIcon } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TripWithRelations } from "@/types/travel";

import { TripCalendar } from "./trip-calendar";
import type { ItineraryViewer } from "@/lib/travel/viewer";

/**
 * The same two readings the planner offers, on a link that grants neither.
 *
 * The list arrives already rendered from the server — it is the one a
 * recipient wants first and the one search engines and preview cards see.
 * The calendar only mounts once it is asked for.
 */
export function PublicTripViews({
  list,
  trip,
  viewer,
}: {
  list: ReactNode;
  trip: TripWithRelations;
  viewer: ItineraryViewer | null;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar")}>
          <TabsList>
            <TabsTrigger value="list" className="gap-1.5">
              <ListIcon className="size-3.5" />
              <span className="hidden sm:inline">List</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <CalendarDays className="size-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === "list" ? (
        list
      ) : (
        <TripCalendar trip={trip} partySize={1} viewer={viewer} readOnly />
      )}
    </div>
  );
}
