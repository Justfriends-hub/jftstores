import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, ShoppingBag, ArrowRight, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { useCart } from "@/lib/cart";

type Theme = { slug: string; css_config: Record<string, string> };
type Seller = {
  id: string; slug: string; business_name: string; description: string | null;
  logo_url: string | null; banner_url: string | null; category: string | null;
  whatsapp_number: string | null; status: string;
  themes: Theme | null;
};
type Product = {
  id: string; name: string; description: string | null;
  price: number; images: string[]; stock: number; category: string | null;
};

export const Route = createFileRoute("/store/$slug")({
  loader: async ({ params }) => {
    const { data: seller, error } = await supabase
      .from("sellers")
      .select("id, slug, business_name, description, logo_url, banner_url, category, whatsapp_number, status, themes(slug, css_config)")
      .eq("slug", params.slug)
      .eq("status", "approved")
      .maybeSingle();
    if (error) throw error;
    if (!seller) throw notFound();
    return { seller: seller as unknown as Seller };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.seller.business_name} — Son of Sun Greece` },
      { name: "description", content: loaderData.seller.description ?? `${loaderData.seller.business_name} on Son of Sun Greece` },
      { property: "og:title", content: loaderData.seller.business_name },
      { property: "og:description", content: loaderData.seller.description ?? "" },
      ...(loaderData.seller.banner_url ? [{ property: "og:image", content: loaderData.seller.banner_url }] : []),
    ] : [{ title: "Store — Son of Sun Greece" }],
  }),
  component: StorePage,
  notFoundComponent: () => (
    <PageShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-3xl">This shop isn't here</h1>
        <p className="mt-3 text-muted-foreground">It may have moved or isn't approved yet.</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/stores">Browse other shops</Link></Button>
      </div>
    </PageShell>
  ),
  errorComponent: ({ error }) => (
    <PageShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-serif text-2xl">We couldn't load this shop</h1>
        <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </PageShell>
  ),
});

function StorePage() {
  const { seller } = Route.useLoaderData();
  const theme = seller.themes?.css_config ?? {};

  const themeStyle = useMemo<React.CSSProperties>(() => ({
    "--store-bg": theme.bg,
    "--store-text": theme.text,
    "--store-card": theme.card ?? theme.surface,
    "--store-border": theme.border,
    "--store-primary": theme.primary,
    "--store-primary-fg": theme.bg,
    "--store-accent": theme.accent,
    "--store-muted": theme.muted,
    "--store-radius": theme.radius,
    fontFamily: theme.fontBody ? `'${theme.fontBody}', Inter, sans-serif` : undefined,
  } as React.CSSProperties), [theme]);

  // Log a visit (anon allowed by RLS)
  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get("src") === "wa" ? "whatsapp" : "direct";
    supabase.from("store_visits").insert({ seller_id: seller.id, source }).then(() => undefined);
  }, [seller.id]);

  const { data: products } = useQuery({
    queryKey: ["products", seller.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price, images, stock, category")
        .eq("seller_id", seller.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  return (
    <PageShell>
      <div className="store-theme" style={themeStyle}>
        {/* Themed banner */}
        <section
          className="relative"
          style={{
            background: seller.banner_url
              ? `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.45)), url(${seller.banner_url}) center/cover`
              : `linear-gradient(135deg, ${theme.primary ?? "#13315c"}, ${theme.accent ?? "#1e6091"})`,
            color: seller.banner_url ? "#fff" : (theme.bg ?? "#fff"),
          }}
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="flex items-end gap-5">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/90 shadow-lg ring-1 ring-black/5">
                {seller.logo_url ? (
                  <img src={seller.logo_url} alt={seller.business_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-serif text-2xl text-black/80">{seller.business_name[0]}</span>
                )}
              </div>
              <div className="min-w-0">
                <h1
                  className="font-serif text-3xl leading-tight drop-shadow-sm sm:text-5xl"
                  style={{ fontFamily: theme.fontHead ? `'${theme.fontHead}', serif` : undefined }}
                >
                  {seller.business_name}
                </h1>
                {seller.category && <div className="mt-1 text-sm opacity-90">{seller.category}</div>}
              </div>
            </div>
            {seller.description && (
              <p className="mt-6 max-w-2xl text-sm opacity-95 sm:text-base">{seller.description}</p>
            )}
            {seller.whatsapp_number && (
              <a
                href={buildWhatsAppLink({ phone: seller.whatsapp_number, storeSlug: seller.slug })}
                target="_blank" rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95"
              >
                <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
              </a>
            )}
          </div>
        </section>

        {/* Products */}
        <section
          className="py-12"
          style={{ backgroundColor: theme.bg ?? undefined, color: theme.text ?? undefined }}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2
              className="mb-6 font-serif text-2xl sm:text-3xl"
              style={{ fontFamily: theme.fontHead ? `'${theme.fontHead}', serif` : undefined }}
            >
              Shop the collection
            </h2>
            {!products ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-80 animate-pulse rounded-2xl bg-black/5" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <EmptyProducts whatsapp={seller.whatsapp_number} slug={seller.slug} />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} seller={seller} theme={theme} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Exit ramp */}
        <section className="border-t" style={{ borderColor: theme.border ?? undefined, backgroundColor: theme.card ?? theme.surface ?? "#fff", color: theme.text ?? undefined }}>
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-12 text-center sm:px-6">
            <h3 className="font-serif text-xl" style={{ fontFamily: theme.fontHead ? `'${theme.fontHead}', serif` : undefined }}>
              Discover other Greek shops
            </h3>
            <p className="text-sm" style={{ color: theme.muted ?? undefined }}>
              You're inside {seller.business_name}'s world. There's more waiting in the marketplace.
            </p>
            <Button asChild className="mt-2 rounded-full">
              <Link to="/stores">Check out other stores <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function ProductCard({ product, seller, theme }: { product: Product; seller: Seller; theme: Record<string, string> }) {
  const { items, add, setQty } = useCart();
  const inCart = items.find((i) => i.productId === product.id);
  const [qty, setLocalQty] = useState(1);

  const handleAdd = () => {
    add(
      {
        productId: product.id,
        sellerId: seller.id,
        sellerSlug: seller.slug,
        sellerName: seller.business_name,
        sellerWhatsApp: seller.whatsapp_number,
        productName: product.name,
        price: Number(product.price),
        image: product.images?.[0] ?? null,
      },
      qty,
    );
    toast.success(`${product.name} added to cart`);
  };

  const radius = theme.radius ?? "0.75rem";

  return (
    <div
      className="store-card overflow-hidden border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderRadius: radius }}
    >
      <div
        className="aspect-square w-full bg-black/5"
        style={product.images?.[0] ? { backgroundImage: `url(${product.images[0]})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{product.name}</h3>
            {product.category && <div className="text-xs opacity-70">{product.category}</div>}
          </div>
          <div className="shrink-0 text-base font-semibold">€{Number(product.price).toFixed(2)}</div>
        </div>
        {product.description && <p className="mt-2 line-clamp-2 text-xs opacity-80">{product.description}</p>}

        <div className="mt-4 flex items-center gap-2">
          {inCart ? (
            <div className="flex items-center gap-1 rounded-full border" style={{ borderColor: theme.border ?? undefined }}>
              <button onClick={() => setQty(product.id, inCart.quantity - 1)} className="grid h-8 w-8 place-items-center hover:opacity-70"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-6 text-center text-sm font-semibold">{inCart.quantity}</span>
              <button onClick={() => setQty(product.id, inCart.quantity + 1)} className="grid h-8 w-8 place-items-center hover:opacity-70"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              disabled={product.stock <= 0}
              className="store-btn-primary inline-flex flex-1 items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
              style={{ borderRadius: radius }}
            >
              <ShoppingBag className="h-4 w-4" />
              {product.stock <= 0 ? "Sold out" : "Add to cart"}
            </button>
          )}
          {seller.whatsapp_number && (
            <a
              href={buildWhatsAppLink({ phone: seller.whatsapp_number, productName: product.name, storeSlug: seller.slug })}
              target="_blank" rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white hover:opacity-95"
              aria-label="WhatsApp seller about this product"
              title="Message on WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
        </div>
        {product.stock > 0 && product.stock <= 5 && (
          <div className="mt-2 text-[11px] opacity-75">Only {product.stock} left</div>
        )}
      </div>
    </div>
  );
}

function EmptyProducts({ whatsapp, slug }: { whatsapp: string | null; slug: string }) {
  return (
    <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: "currentColor", opacity: 0.7 }}>
      <h3 className="font-serif text-xl">No products yet</h3>
      <p className="mt-2 text-sm opacity-80">The shop is still setting up — check back soon.</p>
      {whatsapp && (
        <a
          href={buildWhatsAppLink({ phone: whatsapp, storeSlug: slug })}
          target="_blank" rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white"
        >
          <MessageCircle className="h-4 w-4" /> Say hi on WhatsApp
        </a>
      )}
    </div>
  );
}
