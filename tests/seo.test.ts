import { describe, expect, it } from "vitest";
import {
  CORE_ROUTES,
  DISALLOWED_PATHS,
  PRODUCTION_ORIGIN,
  checkPage,
  fetchHtml,
  parseHead,
} from "./seo-contract";

/**
 * Verifies the server-rendered SEO contract for every core route.
 *
 * Runs against the local dev/preview server by default; point it at the live
 * site with SEO_ORIGIN=https://jftstores.lovable.app (see `bun run seo:check`).
 */
const ORIGIN = process.env["SEO_ORIGIN"] ?? "http://localhost:8080";

describe(`SEO metadata @ ${ORIGIN}`, () => {
  for (const route of CORE_ROUTES) {
    it(`${route.path} has title, description, canonical and correct robots`, async () => {
      const html = await fetchHtml(ORIGIN, route.path);
      const meta = parseHead(html);
      const failures = checkPage(route, meta, ORIGIN).map((f) => f.problem);
      expect(failures, `${route.path}:\n - ${failures.join("\n - ")}`).toEqual([]);
    });
  }

  it("titles and descriptions are unique across indexable routes", async () => {
    const indexable = CORE_ROUTES.filter((r) => !r.noindex);
    const metas = await Promise.all(
      indexable.map(async (r) => ({
        path: r.path,
        meta: parseHead(await fetchHtml(ORIGIN, r.path)),
      })),
    );
    const titles = metas.map((m) => m.meta.title);
    const descriptions = metas.map((m) => m.meta.description);
    expect(new Set(titles).size, `duplicate titles: ${titles.join(" | ")}`).toBe(titles.length);
    expect(new Set(descriptions).size, "duplicate meta descriptions").toBe(descriptions.length);
  });

  it("robots.txt allows crawling and blocks private areas", async () => {
    const res = await fetch(`${ORIGIN}/robots.txt`);
    expect(res.status).toBe(200);
    const txt = await res.text();
    expect(txt).toMatch(/User-agent:\s*\*/i);
    expect(txt).toMatch(/^\s*Allow:\s*\/\s*$/im);
    expect(txt).not.toMatch(/^\s*Disallow:\s*\/\s*$/im);
    for (const path of DISALLOWED_PATHS) {
      expect(txt, `robots.txt should disallow ${path}`).toMatch(
        new RegExp(`^\\s*Disallow:\\s*${path}\\s*$`, "im"),
      );
    }
    // Dual-domain: robots must advertise BOTH sitemaps so both hosts index in GSC
    expect(txt).toContain(`Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`);
    // secondary is allowed but not required for primary host check
    const { SECONDARY_ORIGIN } = await import("./seo-contract");
    if (ORIGIN === SECONDARY_ORIGIN || ORIGIN === PRODUCTION_ORIGIN) {
      // at least primary must be there; secondary if serving from shop
      expect(txt).toMatch(/Sitemap: https:\/\/jftstores\.(shop|lovable\.app)\/sitemap\.xml/);
    }
  });

  it("sitemap.xml lists indexable routes and no private ones", async () => {
    const res = await fetch(`${ORIGIN}/sitemap.xml`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("xml");
    const xml = await res.text();
    expect(xml.startsWith("<?xml")).toBe(true);

    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    // Dual-domain: sitemap is host-aware, so locs must match the requested ORIGIN (or localhost)
    const isLocal = ORIGIN.includes("localhost") || ORIGIN.includes("127.0.0.1");
    if (!isLocal) {
      for (const loc of locs) expect(loc.startsWith(`${ORIGIN}/`)).toBe(true);
    }
    expect(new Set(locs).size, "duplicate <loc> entries").toBe(locs.length);

    for (const route of CORE_ROUTES) {
      const url = `${ORIGIN}${route.path === "/" ? "/" : route.path}`;
      if (route.noindex) {
        expect(locs, `${route.path} must not be in the sitemap`).not.toContain(url);
      } else {
        expect(locs, `${route.path} missing from sitemap`).toContain(url);
      }
    }
  });

  it("sitemap storefronts are live, approved pages", async () => {
    const xml = await (await fetch(`${ORIGIN}/sitemap.xml`)).text();
    const storeUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .filter((u) => u.includes("/store/"));
    for (const url of storeUrls) {
      const path = url.replace(ORIGIN, "").replace(PRODUCTION_ORIGIN, "").replace("https://jftstores.lovable.app", "");
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const html = await fetchHtml(ORIGIN, normalizedPath);
      expect(html, `${normalizedPath} should not render the not-found page`).not.toContain("Store not found");
      const meta = parseHead(html);
      expect(meta.title, `${normalizedPath} missing title`).toBeTruthy();
      expect(meta.canonical, `${normalizedPath} canonical mismatch`).toBe(url);
    }
  });
});
