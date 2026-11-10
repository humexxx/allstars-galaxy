import type { Metadata } from "next";

import { NewTripPreview } from "@/components/travel/assistant/new-trip-preview";
import { requireModulePage } from "@/lib/services/module-access-service";

export const metadata: Metadata = { title: "New trip preview" };

/** A trip the assistant proposes, before it exists. Lives in the browser only. */
export default async function NewTripPreviewPage(): Promise<React.ReactElement> {
  await requireModulePage("travel");
  return <NewTripPreview />;
}
