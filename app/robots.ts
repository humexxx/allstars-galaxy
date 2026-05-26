import type { MetadataRoute } from "next"

import { getBaseUrl } from "@/lib/env"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl()
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/portal/",
          "/login",
          "/signup",
          "/forgot-password",
          "/auth/",
          "/api/",
          // Public trip share pages are intentionally not crawled — they have
          // their own `noindex` meta tag and are meant for direct-link access.
          "/trips/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
