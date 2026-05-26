/**
 * Vercel REST API client for the "More apps" page. Lists all projects
 * under the account associated with `VERCEL_API_TOKEN` and shapes them
 * into the shared `AppListing` type so the page can merge them with the
 * manual Firebase / other entries.
 *
 * If the token is missing or the request fails, returns an empty list
 * and logs once — callers fall back to whatever manual entries exist.
 *
 * Cache: 10 min via Next's fetch cache for the projects list; 24h for
 * user and team slug lookups (those barely ever change).
 *
 * Console URL resolution: each project's `accountId` is either the
 * user's id (personal account, rare on the modern Vercel "northstar"
 * plan) or a team id starting with `team_`. We resolve each unique
 * accountId to its display slug so we can build URLs of the form
 * `https://vercel.com/<slug>/<project>` that actually open in the
 * Vercel dashboard.
 *
 * Docs:
 * - https://vercel.com/docs/rest-api/reference/endpoints/projects/list
 * - https://vercel.com/docs/rest-api/reference/endpoints/user/get-the-user
 * - https://vercel.com/docs/rest-api/reference/endpoints/teams/get-a-team
 */
import { env } from "@/lib/env";
import type {
  AppListing,
  AppProvider,
} from "@/app/portal/more-apps/apps-data";

type VercelDeployment = {
  id?: string;
  url?: string;
  createdAt?: number;
  state?: string;
};

type VercelProject = {
  id: string;
  name: string;
  accountId?: string;
  createdAt?: number;
  updatedAt?: number;
  latestDeployments?: VercelDeployment[];
  targets?: {
    production?: {
      alias?: string[];
      url?: string;
      createdAt?: number;
    };
  };
};

type VercelProjectsResponse = { projects?: VercelProject[] };
type VercelUserResponse = {
  user?: { id?: string; username?: string };
};
type VercelTeamResponse = { slug?: string };

const VERCEL_API_BASE = "https://api.vercel.com";
const PROVIDER: AppProvider = "vercel";

export async function listVercelProjects(): Promise<AppListing[]> {
  const token = env.VERCEL_API_TOKEN;
  if (!token) return [];

  try {
    // Fetch projects + user info in parallel.
    const [projectsRes, user] = await Promise.all([
      fetch(`${VERCEL_API_BASE}/v9/projects?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 600 }, // 10 min
      }),
      fetchVercelUser(token),
    ]);

    if (!projectsRes.ok) {
      console.error(
        `[vercel-service] Failed to list projects: ${projectsRes.status} ${projectsRes.statusText}`
      );
      return [];
    }

    const data = (await projectsRes.json()) as VercelProjectsResponse;
    const projects = data.projects ?? [];

    // Resolve each unique accountId to a URL slug. For user accounts the
    // slug is `user.username`; for teams we have to fetch each team.
    const slugByAccountId = await resolveAccountSlugs(projects, user, token);

    return projects.map((p) => toAppListing(p, slugByAccountId));
  } catch (error) {
    console.error("[vercel-service] Error listing projects:", error);
    return [];
  }
}

async function fetchVercelUser(
  token: string
): Promise<{ id: string; username: string } | null> {
  try {
    const res = await fetch(`${VERCEL_API_BASE}/v2/user`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 86_400 }, // 24h
    });
    if (!res.ok) return null;
    const json = (await res.json()) as VercelUserResponse;
    const id = json.user?.id;
    const username = json.user?.username;
    return id && username ? { id, username } : null;
  } catch {
    return null;
  }
}

async function fetchTeamSlug(
  teamId: string,
  token: string
): Promise<string | null> {
  try {
    const res = await fetch(`${VERCEL_API_BASE}/v2/teams/${teamId}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 86_400 }, // 24h
    });
    if (!res.ok) return null;
    const json = (await res.json()) as VercelTeamResponse;
    return json.slug ?? null;
  } catch {
    return null;
  }
}

async function resolveAccountSlugs(
  projects: VercelProject[],
  user: { id: string; username: string } | null,
  token: string
): Promise<Map<string, string>> {
  const slugs = new Map<string, string>();
  if (user) slugs.set(user.id, user.username);

  const teamIds = [
    ...new Set(
      projects
        .map((p) => p.accountId)
        .filter((id): id is string => Boolean(id?.startsWith("team_")))
    ),
  ];

  await Promise.all(
    teamIds.map(async (teamId) => {
      const slug = await fetchTeamSlug(teamId, token);
      if (slug) slugs.set(teamId, slug);
    })
  );

  return slugs;
}

function toAppListing(
  project: VercelProject,
  slugByAccountId: Map<string, string>
): AppListing {
  // Prefer first production alias (usually the cleanest custom domain),
  // fallback to default <name>.vercel.app subdomain.
  const alias = project.targets?.production?.alias?.[0];
  const url = alias ? `https://${alias}` : `https://${project.name}.vercel.app`;

  // Use latest deployment timestamp if available, otherwise project's
  // last metadata update (less accurate but still useful).
  const lastDeployTs =
    project.latestDeployments?.[0]?.createdAt ?? project.updatedAt;
  const updatedAt = lastDeployTs
    ? new Date(lastDeployTs).toISOString()
    : null;

  // Build console URL. Without a resolved slug we fall back to the
  // generic dashboard — still useful, just not project-specific.
  const accountSlug = project.accountId
    ? slugByAccountId.get(project.accountId)
    : undefined;
  const consoleUrl = accountSlug
    ? `https://vercel.com/${accountSlug}/${project.name}`
    : "https://vercel.com/dashboard";

  return {
    slug: project.name,
    name: humanizeName(project.name),
    description: "", // Vercel doesn't expose project descriptions
    url,
    provider: PROVIDER,
    screenshot: null,
    updatedAt,
    status: "live",
    consoleUrl,
  };
}

function humanizeName(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
