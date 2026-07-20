const CACHE_TTL_SECONDS = 60 * 60 * 24;
const MAX_CONTENT_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;

type CacheLike = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

type CacheStorageLike = {
  default: CacheLike;
};

type RemoteSkillResult = {
  content: string;
  stale: boolean;
};

export class RemoteSkillError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const getCache = () =>
  (globalThis as typeof globalThis & { caches?: CacheStorageLike }).caches
    ?.default;

const readBoundedText = async (response: Response) => {
  const contentLength = Number(response.headers.get("content-length"));
  if (contentLength > MAX_CONTENT_BYTES) {
    throw new RemoteSkillError("Skill content is too large", 502);
  }

  if (!response.body) {
    const content = await response.text();
    if (new TextEncoder().encode(content).byteLength > MAX_CONTENT_BYTES) {
      throw new RemoteSkillError("Skill content is too large", 502);
    }
    return content;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_CONTENT_BYTES) {
        throw new RemoteSkillError("Skill content is too large", 502);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes);
};

const readCachedContent = async (cache: CacheLike, key: Request) => {
  const cached = await cache.match(key);
  if (!cached) return undefined;

  try {
    return await readBoundedText(cached);
  } catch {
    return undefined;
  }
};

export const getRemoteSkill = async (
  rawUrl: string,
): Promise<RemoteSkillResult> => {
  const cache = getCache();
  const cacheKey = new Request(rawUrl);
  const cachedContent = cache
    ? await readCachedContent(cache, cacheKey)
    : undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(rawUrl, {
      signal: controller.signal,
      headers: { Accept: "text/plain" },
    });

    if (!response.ok) {
      if (cachedContent !== undefined && response.status !== 404) {
        return { content: cachedContent, stale: true };
      }
      throw new RemoteSkillError(
        "Skill source unavailable",
        response.status === 404 ? 404 : 502,
      );
    }

    const content = await readBoundedText(response);
    if (cache) {
      await cache.put(
        cacheKey,
        new Response(content, {
          headers: {
            "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
            "Content-Type": "text/plain; charset=utf-8",
          },
        }),
      );
    }

    return { content, stale: false };
  } catch (error) {
    if (cachedContent !== undefined) {
      return { content: cachedContent, stale: true };
    }
    if (error instanceof RemoteSkillError) throw error;
    throw new RemoteSkillError("Error fetching registry skill", 504);
  } finally {
    clearTimeout(timeout);
  }
};
