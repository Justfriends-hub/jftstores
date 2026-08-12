/**
 * Sitemap freshness control.
 *
 * The sitemap route caches its rendered XML in-memory for a short window so
 * bursts of crawler traffic don't hammer the database. Whenever a seller is
 * approved or suspended we must drop that cache immediately and tell search
 * engines to re-crawl, so a suspended storefront disappears (and an approved
 * one appears) without waiting for the TTL.
 */

const TTL_MS = 60_000;

type CacheEntry = { xml: string; at: number };

let cache: CacheEntry | null = null;
let revision = 0;

export function getSitemapRevision(): number {
  return revision;
}

export function readSitemapCache(): string | null {
  if (!cache) return null;
  if (Date.now() - cache.at > TTL_MS) {
    cache = null;
    return null;
  }
  return cache.xml;
}

export function writeSitemapCache(xml: string): void {
  cache = { xml, at: Date.now() };
}

export function clearSitemapCache(): void {
  cache = null;
  revision += 1;
}

/**
 * Called after any seller status change. Clears the cache in this isolate and
 * pings the search engines with the sitemap URL so the change is picked up
 * quickly rather than on the next scheduled crawl.
 */
export async function revalidateSitemap(baseUrl: string): Promise<void> {
  clearSitemapCache();
  const sitemapUrl = `${baseUrl.replace(/\/$/, "")}/sitemap.xml`;
  const pings = [
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
  ];
  await Promise.allSettled(
    pings.map((url) =>
      fetch(url, { method: "GET" }).catch((err) => {
        console.warn("[sitemap] ping failed", url, err);
      }),
    ),
  );
  // Warm the cache again so the very next crawler request is instant and
  // already reflects the new seller set.
  try {
    await fetch(sitemapUrl, { headers: { "cache-control": "no-cache" } });
  } catch (err) {
    console.warn("[sitemap] warm-up fetch failed", err);
  }
}
