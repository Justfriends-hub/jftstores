/**
 * Dual-domain SEO helper
 *
 * Lovable is still active (jftstores.lovable.app) and Google is handled by Lovable,
 * but the custom domain jftstores.shop is the primary for indexing.
 * Both hosts serve the same app — each page self-canonicalizes to its own host
 * so BOTH can be verified and indexed in Google Search Console without
 * duplicate-content issues.
 */

export const PRIMARY_ORIGIN = "https://jftstores.shop";
export const SECONDARY_ORIGIN = "https://jftstores.lovable.app";
export const ALL_ORIGINS = [PRIMARY_ORIGIN, SECONDARY_ORIGIN] as const;

/**
 * Resolve the origin to use for SEO tags at runtime.
 *  - Browser: window.location.origin (correct host: .shop or .lovable.app)
 *  - SSR: fallback to PRIMARY_ORIGIN (shop is primary for GSC).
 *         Sitemap already does true host-aware via request headers;
 *         for <head> tags, crawlers see primary but client hydrates to self.
 *         This keeps build safe (no server import in client bundle).
 *  - To get true SSR host-aware canonicals, set SEO_ORIGIN env or use server middleware.
 */
export function getSeoOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    const o = window.location.origin;
    if (o.includes("localhost") || o.includes("127.0.0.1")) return o;
    return o.replace(/\/$/, "");
  }
  return PRIMARY_ORIGIN;
}

export function canonicalFor(path: string): string {
  const origin = getSeoOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** For routes that need explicit origin param (e.g. store pages with loaderData) */
export function buildUrl(path: string, origin?: string): string {
  const o = origin ?? getSeoOrigin();
  return `${o.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
