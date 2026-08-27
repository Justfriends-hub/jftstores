import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { PageShell } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import { STORE_CATEGORIES } from "@/lib/constants";
import { sanitizeSearchTerm } from "@/lib/search";
import { getSeoOrigin } from "@/lib/seo";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
});

export const Route = createFileRoute("/stores")({
  validateSearch: searchSchema,
  head: () => {
    const origin = getSeoOrigin();
    return {
    meta: [
      { title: "Browse stores — Lawal's Marketplace" },
      { name: "description", content: "Browse independent shops by category on Lawal's Marketplace: fashion, food, beauty, jewelry and more." },
      { property: "og:title", content: "Browse stores — Lawal's Marketplace" },
      { property: "og:description", content: "Browse independent shops by category on Lawal's Marketplace: fashion, food, beauty, jewelry and more." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${origin}/stores` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Browse stores — Lawal's Marketplace" },
      { name: "twitter:description", content: "Browse independent shops by category on Lawal's Marketplace: fashion, food, beauty, jewelry and more." },
    ],
    links: [{ rel: "canonical", href: `${origin}/stores` }],
  };
  },
  component: StoresPage,
});

function StoresPage() {
  const { q, category } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data: stores, isLoading } = useQuery({
    queryKey: ["sellers", "approved", category ?? null, q ?? null],
    queryFn: async () => {
      let query = supabase
        .from("sellers")
        .select("id, slug, business_name, description, logo_url, banner_url, category")
        .eq("status", "approved")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      if (category) query = query.eq("category", category);
      const term = q ? sanitizeSearchTerm(q) : "";
      if (term) query = query.or(`business_name.ilike.%${term}%,description.ilike.%${term}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PageShell>
      <section className="border-b border-border bg-gradient-to-b from-[var(--sand)] to-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <h1 className="font-serif text-3xl sm:text-4xl">Browse stores</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Independent makers, hand-picked and approved. Tap any shop to enter their world.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => navigate({ search: { q, category: undefined } })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                !category ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground"
              }`}
            >
              All
            </button>
            {STORE_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => navigate({ search: { q, category: c } })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  category === c ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-border bg-muted/40" />
            ))}
          </div>
        ) : !stores || stores.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <h3 className="font-serif text-xl">No shops match yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {q || category ? "Try clearing your filters." : "Check back soon — new makers join every week."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => (
              <Link
                key={s.id}
                to="/store/$slug"
                params={{ slug: s.slug }}
                className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="aspect-[16/9] w-full bg-gradient-to-br from-[var(--sun)]/40 to-[var(--ocean)]/30"
                  style={s.banner_url ? { backgroundImage: `url(${s.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                />
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-muted">
                      {s.logo_url ? (
                        <img src={s.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-serif">{s.business_name?.[0] ?? "•"}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{s.business_name}</div>
                      {s.category && <div className="truncate text-xs text-muted-foreground">{s.category}</div>}
                    </div>
                  </div>
                  {s.description && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{s.description}</p>}
                  <div className="mt-4 text-sm font-medium text-[var(--ocean)] group-hover:underline">Enter shop →</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
