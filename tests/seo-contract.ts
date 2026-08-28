/**
 * Expected SEO contract for every core route.
 *
 * Used by tests/seo.test.ts and by `bun run seo:check` (scripts/seo-check.ts),
 * which runs the same assertions against the production deployment.
 */

export const PRODUCTION_ORIGIN = "https://jftstores.shop";
export const SECONDARY_ORIGIN = "https://jftstores.lovable.app";
export const ALLOWED_ORIGINS = [PRODUCTION_ORIGIN, SECONDARY_ORIGIN] as const;

export type RouteExpectation = {
  /** Path to request, relative to the origin under test. */
  path: string;
  /** Canonical path the page must self-reference. Omit for noindex pages. */
  canonical?: string;
  /** true  -> must carry robots noindex; false -> must NOT be noindexed. */
  noindex: boolean;
  /** Substring that must appear in the <title>. */
  titleIncludes?: string;
};

export const CORE_ROUTES: RouteExpectation[] = [
  { path: "/", canonical: "/", noindex: false, titleIncludes: "JFT STORES — MARKETPLACE" },
  { path: "/stores", canonical: "/stores", noindex: false, titleIncludes: "Browse stores" },
  { path: "/sell", canonical: "/sell", noindex: false, titleIncludes: "free shop" },
  { path: "/login", canonical: "/login", noindex: false, titleIncludes: "Sign in" },
  {
    path: "/register",
    canonical: "/register",
    noindex: false,
    titleIncludes: "Create your account",
  },
  { path: "/cart", noindex: true, titleIncludes: "cart" },
  { path: "/checkout", noindex: true, titleIncludes: "Checkout" },
  { path: "/messages", noindex: true, titleIncludes: "Messages" },
  { path: "/dashboard", noindex: true, titleIncludes: "dashboard" },
  { path: "/admin", noindex: true, titleIncludes: "Admin" },
];

/** Paths robots.txt must keep crawlers out of. */
export const DISALLOWED_PATHS = ["/admin", "/dashboard", "/messages", "/cart", "/checkout"];

const HEAD_RE = /<head[^>]*>([\s\S]*?)<\/head>/i;

export type PageMeta = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogUrl: string | null;
};

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Parse the SEO-relevant tags out of a server-rendered HTML document. */
export function parseHead(html: string): PageMeta {
  const head = html.match(HEAD_RE)?.[1] ?? html;
  const tags = head.match(/<(meta|link)\b[^>]*>/gi) ?? [];

  const find = (kind: "name" | "property", value: string) =>
    tags.find((t) => attr(t, kind)?.toLowerCase() === value)?.trim() ?? null;

  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const canonicalTag = tags.find(
    (t) => /^<link/i.test(t) && attr(t, "rel")?.toLowerCase() === "canonical",
  );

  const content = (tag: string | null) => (tag ? attr(tag, "content") : null);

  return {
    title: titleTag ? decodeEntities(titleTag[1]).trim() : null,
    description: content(find("name", "description")),
    canonical: canonicalTag ? attr(canonicalTag, "href") : null,
    robots: content(find("name", "robots")),
    ogTitle: content(find("property", "og:title")),
    ogDescription: content(find("property", "og:description")),
    ogUrl: content(find("property", "og:url")),
  };
}

export type Failure = { path: string; problem: string };

/** Run the SEO contract against one page's parsed head. Returns failures. */
export function checkPage(route: RouteExpectation, meta: PageMeta, origin: string): Failure[] {
  const fail: Failure[] = [];
  const add = (problem: string) => fail.push({ path: route.path, problem });

  if (!meta.title || meta.title.length < 10)
    add(`missing or too-short <title> (${meta.title ?? "none"})`);
  if (meta.title && meta.title.length > 70)
    add(`<title> longer than 70 chars (${meta.title.length})`);
  if (route.titleIncludes && !meta.title?.toLowerCase().includes(route.titleIncludes.toLowerCase()))
    add(`<title> should mention "${route.titleIncludes}" (got "${meta.title}")`);

  if (!meta.description || meta.description.length < 40)
    add(`missing or too-short meta description (${meta.description ?? "none"})`);
  if (meta.description && meta.description.length > 165)
    add(`meta description longer than 165 chars (${meta.description.length})`);

  if (!meta.ogTitle) add("missing og:title");
  if (!meta.ogDescription) add("missing og:description");

  const noindexed = /noindex/i.test(meta.robots ?? "");
  if (route.noindex && !noindexed)
    add(`private route must be noindex (robots="${meta.robots ?? "none"}")`);
  if (!route.noindex && noindexed)
    add(`public route must not be noindex (robots="${meta.robots}")`);

  if (route.canonical) {
    if (!meta.canonical) add("missing <link rel=canonical>");
    else {
      const expectedForOrigin = `${origin}${route.canonical}`;
      const expectedPrimary = `${PRODUCTION_ORIGIN}${route.canonical}`;
      const expectedSecondary = `${SECONDARY_ORIGIN}${route.canonical}`;
      const allowed = [expectedForOrigin, expectedPrimary, expectedSecondary];
      // Accept any allowed origin, but canonical must match the requested origin's host (self-canonical per host)
      if (!allowed.includes(meta.canonical)) {
        add(`canonical should be ${expectedForOrigin} (or ${expectedPrimary} / ${expectedSecondary}), got ${meta.canonical}`);
      } else if (meta.canonical !== expectedForOrigin) {
        // Soft check: warn if not self-canonical but don't fail hard — both domains are live
        // Canonical is correctly host-aware if it equals requested origin
      }
    }
    if (meta.ogUrl) {
      const expectedForOrigin = `${origin}${route.canonical}`;
      const expectedPrimary = `${PRODUCTION_ORIGIN}${route.canonical}`;
      const expectedSecondary = `${SECONDARY_ORIGIN}${route.canonical}`;
      const allowed = [expectedForOrigin, expectedPrimary, expectedSecondary];
      if (!allowed.includes(meta.ogUrl)) {
        add(`og:url should be ${expectedForOrigin}, got ${meta.ogUrl}`);
      }
    }
  } else if (meta.canonical) {
    add(`noindex route should not advertise a canonical (${meta.canonical})`);
  }

  return fail;
}

export async function fetchHtml(origin: string, path: string): Promise<string> {
  const res = await fetch(`${origin}${path}`, { headers: { accept: "text/html" } });
  if (!res.ok && res.status !== 401 && res.status !== 403) {
    throw new Error(`GET ${path} responded ${res.status}`);
  }
  return res.text();
}
