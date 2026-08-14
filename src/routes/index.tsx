import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sun, Sparkles, MessageCircle, ShoppingBag } from "lucide-react";
import { PageShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BRAND, STORE_CATEGORIES } from "@/lib/constants";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lawal's Marketplace — Many stores, one cart" },
      { name: "description", content: "A marketplace where independent store owners host their own storefronts. Browse stores, negotiate with sellers, and check out in one cart." },
      { property: "og:title", content: "Lawal's Marketplace — Many stores, one cart" },
      { property: "og:description", content: "A marketplace where independent store owners host their own storefronts. Browse stores, negotiate with sellers, and check out in one cart." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://jftstores.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Lawal's Marketplace — Many stores, one cart" },
      { name: "twitter:description", content: "A marketplace where independent store owners host their own storefronts. Browse stores, negotiate with sellers, and check out in one cart." },
    ],
    links: [{ rel: "canonical", href: "https://jftstores.lovable.app/" }],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: featured } = useQuery({
    queryKey: ["sellers", "featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sellers")
        .select("id, slug, business_name, description, logo_url, banner_url, category, is_featured")
        .eq("status", "approved")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PageShell>
      {/* Hero */}
      <section className="bg-hero-sun">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-[var(--terracotta)]" />
              A marketplace for independent store owners
            </span>
            <h1 className="mt-5 font-serif text-4xl leading-tight text-balance text-foreground sm:text-5xl md:text-6xl">
              Lawal's Marketplace — shop small. <span className="text-[var(--terracotta)]">Live warm.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              {BRAND.tagline} Free storefronts for sellers, one cart for shoppers, and WhatsApp built in.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/stores">
                  Browse stores <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/sell">Open your free shop</Link>
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Sun className="h-4 w-4 text-[var(--sun)]" /> Free for sellers</span>
              <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-4 w-4 text-[var(--ocean)]" /> WhatsApp built in</span>
              <span className="inline-flex items-center gap-1.5"><ShoppingBag className="h-4 w-4 text-[var(--terracotta)]" /> One cart, many shops</span>
            </div>
          </div>
          <div className="relative hidden md:block">
            <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-[var(--sun)]/30 via-transparent to-[var(--terracotta)]/20 blur-2xl" />
            <div className="relative grid grid-cols-2 gap-4">
              {[
                { label: "Aegean ceramics", tone: "var(--ocean)" },
                { label: "Olive & honey", tone: "var(--olive)" },
                { label: "Linen by hand", tone: "var(--sand)" },
                { label: "Cycladic jewelry", tone: "var(--terracotta)" },
              ].map((c, i) => (
                <div
                  key={c.label}
                  className="aspect-[4/5] rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5"
                  style={{ transform: `translateY(${i % 2 ? 16 : 0}px)` }}
                >
                  <div className="h-2/3 rounded-2xl" style={{ background: `linear-gradient(135deg, ${c.tone}, oklch(0.92 0.06 80))` }} />
                  <p className="mt-3 font-serif text-lg">{c.label}</p>
                  <p className="text-xs text-muted-foreground">From independent stores</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-serif text-2xl sm:text-3xl">Shop by category</h2>
          <Link to="/stores" className="text-sm text-muted-foreground hover:text-foreground">
            See all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {STORE_CATEGORIES.map((c) => (
            <Link
              key={c}
              to="/stores"
              search={{ q: undefined, category: c }}
              className="group rounded-2xl border border-border bg-card p-4 transition hover:border-[var(--sun)] hover:shadow-sm"
            >
              <div className="text-sm font-medium">{c}</div>
              <div className="mt-1 text-xs text-muted-foreground">Browse →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured stores */}
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-serif text-2xl sm:text-3xl">Featured shops</h2>
          <Link to="/stores" className="text-sm text-muted-foreground hover:text-foreground">
            Browse all stores →
          </Link>
        </div>
        {(!featured || featured.length === 0) ? (
          <EmptyMakersCallout />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((s) => (
              <Link
                key={s.id}
                to="/store/$slug"
                params={{ slug: s.slug }}
                className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="aspect-[16/10] w-full bg-gradient-to-br from-[var(--sun)]/40 to-[var(--ocean)]/30"
                  style={s.banner_url ? { backgroundImage: `url(${s.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                />
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-muted">
                      {s.logo_url ? (
                        <img src={s.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-serif text-sm">{s.business_name?.[0] ?? "•"}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{s.business_name}</div>
                      {s.category && <div className="truncate text-xs text-muted-foreground">{s.category}</div>}
                    </div>
                  </div>
                  {s.description && (
                    <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Sell with us */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[var(--ocean)] to-[oklch(0.32_0.12_250)] p-8 text-[var(--ocean-foreground)] sm:p-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-2xl sm:text-3xl">Already selling on WhatsApp or Instagram?</h2>
            <p className="mt-3 text-sm opacity-90 sm:text-base">
              Get a free, beautiful storefront in minutes. Pick a theme, add products,
              and start sharing your link. We handle the cart and checkout — you get the order.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary" className="rounded-full">
                <Link to="/sell">Open my free shop</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/stores">See live shops</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function EmptyMakersCallout() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <h3 className="font-serif text-xl">The makers are warming up</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Shops are being approved as we speak. Be one of the first to open yours.
      </p>
      <Button asChild className="mt-5 rounded-full">
        <Link to="/sell">Open your free shop</Link>
      </Button>
    </div>
  );
}
