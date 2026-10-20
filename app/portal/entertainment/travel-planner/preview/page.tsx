import type { Metadata } from "next";

import { NewTripPreview } from "@/components/travel/assistant/new-trip-preview";

export const metadata: Metadata = { title: "New trip preview" };

/** A trip the assistant proposes, before it exists. Lives in the browser only. */
export default function NewTripPreviewPage() {
  return <NewTripPreview />;
}
