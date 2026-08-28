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

  // Storefronts: only approved sellers WITH at least one active product (no thin empty pages in sitemap)
  try {
    const { data: sellers, error } = await supabase.from("sellers").select("id, slug, status").eq("status", "approved");
    if (error) throw error;
    const ids = (sellers ?? []).map((s: any) => s.id);
    const productsBySeller = new Set<string>();
    if (ids.length) {
      const { data: prods } = await supabase.from("products").select("seller_id").eq("is_active", true).in("seller_id", ids);
      for (const p of prods ?? []) productsBySeller.add((p as any).seller_id);
    }
    for (const s of sellers ?? []) if (s.slug && s.status === "approved" && productsBySeller.has(s.id)) entries.push({ path: `/store/${s.slug}`, changefreq: "weekly", priority: "0.7" });
  } catch (err) { console.error("[sitemap] storefront list unavailable", err); }

  // PRODUCTS: biggest SEO surface — each product gets its own indexable URL
  // Only active products from approved sellers. This is what makes ChatGPT find "buy X in Nigeria"
  try {
    const { data: sellers } = await supabase.from("sellers").select("id").eq("status", "approved");
    const ids = (sellers ?? []).map((s: any) => s.id);
    if (ids.length) {
      const { data: products, error: pErr } = await supabase.from("products").select("id, updated_at").eq("is_active", true).in("seller_id", ids).order("updated_at", { ascending: false }).limit(5000);
      if (pErr) throw pErr;
      for (const p of products ?? []) entries.push({ path: `/product/${p.id}`, changefreq: "weekly", priority: "0.8" });
    }
  } catch (err) { console.error("[sitemap] product list unavailable", err); }

  // CATEGORY dedicated SEO pages (preferred over query params for indexing)
  const catSlugs = ["fashion-apparel","beauty-skincare","home-decor","food-drink","art-crafts","jewelry","kids-baby","wellness"];
  for (const slug of catSlugs) entries.push({ path: `/category/${slug}`, changefreq: "weekly", priority: "0.7" });
  // keep query variant as fallback but lower priority
  const categories = ["Fashion & Apparel","Beauty & Skincare","Home & Decor","Food & Drink","Art & Crafts","Jewelry","Kids & Baby","Wellness"];
  for (const c of categories) entries.push({ path: `/stores?category=${encodeURIComponent(c)}`, changefreq: "weekly", priority: "0.4" });

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
