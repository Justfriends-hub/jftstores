import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = "https://jftstores.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/stores", changefreq: "daily", priority: "0.9" },
          { path: "/sell", changefreq: "monthly", priority: "0.8" },
          { path: "/login", changefreq: "yearly", priority: "0.3" },
          { path: "/register", changefreq: "yearly", priority: "0.3" },
        ];

        // Storefronts: only approved (published) sellers. Pending and
        // suspended sellers are excluded automatically by this filter, so a
        // store disappears from the sitemap the moment admin suspends it.
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
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
