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
 *  - SSR: request Host header (via getRequest) with fallback to PRIMARY
 *  - Static fallback: PRIMARY_ORIGIN
 */
export function getSeoOrigin(): string {
  // Browser: always use the actual host the user is on
  if (typeof window !== "undefined" && window.location?.origin) {
    const o = window.location.origin;
    // Normalize localhost for dev
    if (o.includes("localhost") || o.includes("127.0.0.1")) return o;
    return o.replace(/\/$/, "");
  }
  // SSR: try TanStack Start request
  try {
    // Lazy require so client bundle doesn't break
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getRequest } = require("@tanstack/react-start/server") as {
      getRequest: () => Request | undefined;
    };
    const req = getRequest?.();
    const host = req?.headers.get("host");
    if (host) {
      if (/^localhost(:|$)/i.test(host) || /^127\.0\.0\.1(:|$)/.test(host)) {
        const proto = req?.headers.get("x-forwarded-proto") ?? "http";
        return `${proto}://${host}`.replace(/\/$/, "");
      }
      return `https://${host}`.replace(/\/$/, "");
    }
    if (req?.url) return new URL(req.url).origin.replace(/\/$/, "");
  } catch {
    // ignore - not in SSR context
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
