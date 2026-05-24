import type { MetadataRoute } from "next"

import { getBaseUrl } from "@/lib/env"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl()
  const now = new Date()
  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1.0,
    },
  ]
}
