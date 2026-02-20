export const DEFAULT_TIMEOUT_MS = 7000;
export const DEFAULT_TTL_SECONDS = 300;

export function cacheHeaders(ttlSeconds = DEFAULT_TTL_SECONDS) {
  const swr = Math.max(60, Math.floor(ttlSeconds / 2));
  return {
    "Cache-Control": `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${swr}`,
  };
}

export const noStoreHeaders = {
  "Cache-Control": "no-store",
};

type NextFetchInit = RequestInit & {
  next?: { revalidate: number };
};

export async function fetchWithTimeout(
  url: string,
  init: NextFetchInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
