import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import { STORE_CATEGORIES } from "@/lib/constants";

const SLUG_MAP: Record<string, string> = {
  "fashion-apparel": "Fashion & Apparel",
  "beauty-skincare": "Beauty & Skincare",
  "home-decor": "Home & Decor",
  "food-drink": "Food & Drink",
  "art-crafts": "Art & Crafts",
  "jewelry": "Jewelry",
  "kids-baby": "Kids & Baby",
  "wellness": "Wellness",
};

export const Route = createFileRoute("/category/$slug")({
  loader: ({ params }) => {
    const cat = SLUG_MAP[params.slug];
    if (!cat) throw notFound();
    return { category: cat, slug: params.slug };
  },
  head: ({ loaderData, params }) => {
    const cat = (loaderData as any)?.category ?? SLUG_MAP[params.slug] ?? "Category";
    const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin.replace(/\/$/, "") : "https://jftstores.shop";
    const url = `${origin}/category/${params.slug}`;
    const title = `${cat} Stores in Nigeria — Buy ${cat} Online | Lawal's Marketplace`;
    const desc = `Shop ${cat} from independent Nigerian sellers on Lawal's Marketplace. Browse approved stores, chat on WhatsApp, pay once with Paystack. Delivery across Nigeria.`;
    const itemListLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description: desc,
      url,
      isPartOf: { "@type": "WebSite", name: "Lawal's Marketplace", url: origin },
    };
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: origin },
        { "@type": "ListItem", position: 2, name: "Stores", item: `${origin}/stores` },
        { "@type": "ListItem", position: 3, name: cat, item: url },
      ],
    };
    return {
      meta: [
        { title: title.slice(0, 68) },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(itemListLd) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
      ],
    };
  },
  component: CategoryPage,
  notFoundComponent: () => (
    <PageShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-3xl">Category not found</h1>
        <Link to="/stores" className="mt-6 inline-block rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">Browse all stores</Link>
      </div>
    </PageShell>
  ),
});

function CategoryPage() {
  const { category, slug } = Route.useLoaderData();
  const { data: stores, isLoading } = useQuery({
    queryKey: ["category", category],
    queryFn: async () => {
      const { data, error } = await supabase.from("sellers").select("id, slug, business_name, description, logo_url, banner_url, category").eq("status", "approved").eq("category", category).order("is_featured", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PageShell>
      <section className="border-b border-border bg-gradient-to-b from-[var(--sand)] to-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <nav className="text-xs text-muted-foreground"><Link to="/" className="hover:text-foreground">Home</Link> / <Link to="/stores" className="hover:text-foreground">Stores</Link> / {category}</nav>
          <h1 className="mt-3 font-serif text-3xl sm:text-4xl">{category} Stores in Nigeria</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Nigeria’s marketplace for independent {category.toLowerCase()} sellers. Discover approved shops, message on WhatsApp, and check out in one cart. {category} delivered across Lagos, Abuja, Port Harcourt and nationwide.
          </p>
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
            <h3 className="font-serif text-xl">No {category} shops yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">Be first to open a {category.toLowerCase()} store — it’s free.</p>
            <Link to="/sell" className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">Open your free shop</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => (
              <Link key={s.id} to="/store/$slug" params={{ slug: s.slug }} className="group overflow-hidden rounded-2xl border border-border bg-card hover:shadow-md transition">
                <div className="aspect-[16/9] w-full bg-gradient-to-br from-[var(--sun)]/40 to-[var(--ocean)]/30" style={s.banner_url ? { backgroundImage: `url(${s.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
                <div className="p-5">
                  <div className="truncate font-semibold">{s.business_name}</div>
                  <div className="text-xs text-muted-foreground">{s.category}</div>
                  {s.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{s.description}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
        <p className="mt-8 text-xs text-muted-foreground">More: <Link to="/stores" className="underline">All stores</Link> • <Link to="/" className="underline">Marketplace home</Link></p>
      </section>
    </PageShell>
  );
}
