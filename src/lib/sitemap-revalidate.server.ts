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

// One cache entry per serving host: jftstores.shop and jftstores.lovable.app
// each get their own rendered XML (the <loc> URLs differ per domain).
const caches = new Map<string, CacheEntry>();
let revision = 0;

export function getSitemapRevision(): number {
  return revision;
}

export function readSitemapCache(baseUrl: string): string | null {
  const entry = caches.get(baseUrl);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    caches.delete(baseUrl);
    return null;
  }
  return entry.xml;
}

export function writeSitemapCache(baseUrl: string, xml: string): void {
  caches.set(baseUrl, { xml, at: Date.now() });
}

export function clearSitemapCache(): void {
  caches.clear();
  revision += 1;
}

/**
 * Called after any seller status change. Clears the cache in this isolate and
 * pings the search engines with the sitemap URL so the change is picked up
 * quickly rather than on the next scheduled crawl. Both live domains are
 * pinged so each host's sitemap stays fresh.
 */
export async function revalidateSitemap(baseUrls: string | string[]): Promise<void> {
  clearSitemapCache();
  const urls = (Array.isArray(baseUrls) ? baseUrls : [baseUrls]).map(
    (b) => `${b.replace(/\/$/, "")}/sitemap.xml`,
  );
  const pings = urls.flatMap((sitemapUrl) => [
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
  ]);
  await Promise.allSettled(
    pings.map((url) =>
      fetch(url, { method: "GET" }).catch((err) => {
        console.warn("[sitemap] ping failed", url, err);
      }),
    ),
  );
  // Warm the cache again so the very next crawler request is instant and
  // already reflects the new seller set.
  await Promise.allSettled(
    urls.map((sitemapUrl) =>
      fetch(sitemapUrl, { headers: { "cache-control": "no-cache" } }).catch((err) => {
        console.warn("[sitemap] warm-up fetch failed", sitemapUrl, err);
      }),
    ),
  );
}
