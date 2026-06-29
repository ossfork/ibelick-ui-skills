import type { APIRoute } from "astro";
import { formatStarCount } from "../../lib/format-stars.ts";

type GitHubRepoResponse = {
  stargazers_count?: number;
};

type CacheLike = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

type CacheStorageLike = {
  default: CacheLike;
};

const REPO_URL = "https://api.github.com/repos/ibelick/ui-skills";
const CACHE_KEY = "https://www.ui-skills.com/api/github-stars";
const CACHE_SECONDS = 60 * 60 * 24;

export const GET: APIRoute = async () => {
  const cache = (globalThis as typeof globalThis & { caches?: CacheStorageLike })
    .caches?.default;
  const cacheKey = new Request(CACHE_KEY);
  const cached = cache ? await cache.match(cacheKey) : undefined;

  if (cached) {
    return cached;
  }

  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "User-Agent": "ui-skills",
  });

  const response = await fetch(REPO_URL, { headers });
  const payload = (await response.json()) as GitHubRepoResponse;
  const stars = payload.stargazers_count ?? 0;
  const label = formatStarCount(stars);

  const result = Response.json(
    { stars, label },
    {
      headers: {
        "Cache-Control": `public, max-age=0, s-maxage=${CACHE_SECONDS}, must-revalidate`,
      },
    },
  );

  if (cache) {
    await cache.put(cacheKey, result.clone());
  }

  return result;
};
