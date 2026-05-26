import type { NextConfig } from "next";

import { version } from "./package.json";

// Derive the Supabase storage hostname from the public URL so trip-photos and
// any other storage buckets render through `next/image` without needing a
// hard-coded project ref. Falls back to a wildcard *.supabase.co pattern so
// local dev/preview environments still work if the env var is unset at build.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = (() => {
  if (!supabaseUrl) return undefined;
  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  images: {
    remotePatterns: [
      // Google OAuth profile photos.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      // Supabase Storage (trip photos, future buckets). Prefer the exact
      // project hostname when available so we don't open the optimizer up
      // to arbitrary Supabase projects.
      ...(supabaseHostname
        ? ([{ protocol: "https", hostname: supabaseHostname }] as const)
        : ([{ protocol: "https", hostname: "*.supabase.co" }] as const)),
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-tooltip",
      "cmdk",
    ],
  },
};

export default nextConfig;
