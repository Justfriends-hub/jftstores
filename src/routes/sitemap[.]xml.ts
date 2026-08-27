import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { readSitemapCache, writeSitemapCache } from "@/lib/sitemap-revalidate.server";

// The sitemap is served from both live domains (jftstores.shop and
// jftstores.lovable.app). Sitemap URLs must match the host serving the file,
// so the base URL is resolved from the incoming request, with the custom
// domain as the fallback.
const DEFAULT_BASE_URL = "https://jftstores.shop";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

function resolveBaseUrl(request: Request): string {
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (!host) return DEFAULT_BASE_URL;
  if (/^localhost(:|$)/i.test(host) || /^127\.0\.0\.1(:|$)/.test(host)) {
    return `http://${host}`;
  }
  return `https://${host}`;
}

async function buildSitemap(baseUrl: string): Promise<string> {
  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "daily", priority: "1.0" },
    { path: "/stores", changefreq: "daily", priority: "0.9" },
    { path: "/sell", changefreq: "monthly", priority: "0.8" },
    { path: "/login", changefreq: "yearly", priority: "0.3" },
    { path: "/register", changefreq: "yearly", priority: "0.3" },
  ];

  // Storefronts: only approved (published) sellers. Pending and suspended
  // sellers are excluded automatically, so a store leaves the sitemap the
  // moment an admin suspends it (the admin action also clears the cache).
  try {
    const { data, error } = await supabase
      .from("sellers")
      .select("slug, status")
      .eq("status", "approved")
      .order("business_name", { ascending: true });
    if (error) throw error;
    for (const s of data ?? []) {
      if (s.slug && s.status === "approved") {
        entries.push({ path: `/store/${s.slug}`, changefreq: "weekly", priority: "0.7" });
      }
    }
  } catch (err) {
    console.error("[sitemap] storefront list unavailable", err);
  }

  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${baseUrl}${e.path}</loc>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const baseUrl = resolveBaseUrl(request);
        const noCache = /no-cache/i.test(request.headers.get("cache-control") ?? "");
        let xml = noCache ? null : readSitemapCache(baseUrl);
        if (!xml) {
          xml = await buildSitemap(baseUrl);
          writeSitemapCache(baseUrl, xml);
        }

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            // Short TTL so seller approve/suspend propagates fast; the admin
            // action additionally revalidates and pings the search engines.
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          },
        });
      },
    },
  },
});
