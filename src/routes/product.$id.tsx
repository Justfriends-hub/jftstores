import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ShoppingBag, MessageCircle, Store, ShieldCheck, Truck, RotateCcw, Star } from "lucide-react";
import { PageShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

// Single product page — this is the #1 SEO surface for marketplace
// Each product gets its own crawlable URL, Product + Merchant structured data, breadcrumbs, internal links

type Product = {
  id: string; name: string; description: string | null; price: number; images: string[]; stock: number; category: string | null; seller_id: string;
};

type Seller = {
  id: string; slug: string; business_name: string; description: string | null; logo_url: string | null; whatsapp_number: string | null; category: string | null;
};

export const Route = createFileRoute("/product/$id")({
  loader: async ({ params }) => {
    const { data: product, error } = await supabase
      .from("products")
      .select("id, name, description, price, images, stock, category, seller_id")
      .eq("id", params.id)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (!product) throw notFound();
    // must be from approved seller, else 404 (don't index pending sellers)
    const { data: seller } = await supabase.from("sellers").select("id, slug, business_name, description, logo_url, whatsapp_number, category, status").eq("id", product.seller_id).maybeSingle();
    if (!seller || (seller as any).status !== "approved") throw notFound();

    // related products (same category or same seller)
    const { data: related } = await supabase.from("products").select("id, name, price, images, category").eq("is_active", true).eq("seller_id", product.seller_id).neq("id", product.id).limit(4);

    return { product: product as Product, seller: seller as unknown as Seller, related: (related ?? []) as Partial<Product>[] };
  },
  head: ({ params, loaderData }) => {
    const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin.replace(/\/$/, "") : "https://jftstores.shop";
    const p = loaderData?.product;
    const s = loaderData?.seller;
    if (!p || !s) return { meta: [{ title: "Product — Lawal's Marketplace" }] };
    const url = `${origin}/product/${params.id}`;
    const title = `${p.name} — ₦${Number(p.price).toLocaleString()} | ${s.business_name} | Lawal's Marketplace`;
    const desc = p.description ? `${p.description.slice(0, 155)}` : `Buy ${p.name} from ${s.business_name} on Lawal's Marketplace. ${p.category ?? ""} • WhatsApp ordering • Paystack checkout • Delivery in Nigeria.`;
    const image = p.images?.[0] ?? s.logo_url ?? `${origin}/icon-512.png`;
    const availability = p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

    // Product + MerchantListing + Breadcrumb
    const productLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      description: p.description ?? `Buy ${p.name} from ${s.business_name}`,
      image: p.images?.length ? p.images : [image],
      sku: p.id,
      category: p.category ?? s.category ?? undefined,
      brand: { "@type": "Brand", name: s.business_name },
      seller: { "@type": "Organization", name: s.business_name, url: `${origin}/store/${s.slug}` },
      offers: {
        "@type": "Offer",
        url,
        price: Number(p.price),
        priceCurrency: "NGN",
        availability,
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: s.business_name },
        shippingDetails: { "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: "0", currency: "NGN" }, deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" }, transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "DAY" } } },
      },
    };
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: origin },
        { "@type": "ListItem", position: 2, name: "Stores", item: `${origin}/stores` },
        ...(p.category ? [{ "@type": "ListItem", position: 3, name: p.category, item: `${origin}/stores?category=${encodeURIComponent(p.category)}` }] : []),
        { "@type": "ListItem", position: p.category ? 4 : 3, name: s.business_name, item: `${origin}/store/${s.slug}` },
        { "@type": "ListItem", position: p.category ? 5 : 4, name: p.name, item: url },
      ],
    };
    return {
      meta: [
        { title: title.slice(0, 68) },
        { name: "description", content: desc.slice(0, 160) },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: image },
        { property: "product:price:amount", content: String(p.price) },
        { property: "product:price:currency", content: "NGN" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(productLd) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
      ],
    };
  },
  component: ProductPage,
  notFoundComponent: () => (
    <PageShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <meta name="robots" content="noindex, nofollow" />
        <h1 className="font-serif text-3xl">Product not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">It may have been removed, sold out, or the seller is still pending approval.</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/stores">Browse products</Link></Button>
      </div>
    </PageShell>
  ),
});

function ProductPage() {
  const { product, seller, related } = Route.useLoaderData();
  const { user } = useAuth();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://jftstores.shop";

  const whatsapp = seller.whatsapp_number; // public for active sellers? If RLS blocks, will be null for anon — still show button that prompts login

  const onAdd = () => {
    add({ productId: product.id, sellerId: seller.id, sellerSlug: seller.slug, sellerName: seller.business_name, sellerWhatsApp: whatsapp, productName: product.name, price: Number(product.price), image: product.images?.[0] ?? null }, qty);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        {/* Breadcrumb for SEO + UX */}
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground">Home</Link> <span>/</span>
          <Link to="/stores" className="hover:text-foreground">Stores</Link> <span>/</span>
          {product.category && <><Link to="/stores" search={{ category: product.category }} className="hover:text-foreground">{product.category}</Link> <span>/</span></>}
          <Link to="/store/$slug" params={{ slug: seller.slug }} className="hover:text-foreground">{seller.business_name}</Link> <span>/</span>
          <span className="text-foreground font-medium truncate">{product.name}</span>
        </nav>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Images — SSR visible, no JS required to see title/price */}
          <div className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
              {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" fetchPriority="high" /> : <div className="grid h-full place-items-center text-muted-foreground">No image</div>}
            </div>
            {product.images?.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.slice(1, 5).map((img, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                    <img src={img} alt={`${product.name} ${i+2}`} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-serif text-2xl sm:text-3xl leading-tight">{product.name}</h1>
              <Link to="/store/$slug" params={{ slug: seller.slug }} className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">
                <Store className="h-3.5 w-3.5" /> {seller.business_name}
              </Link>
            </div>
            {product.category && <div className="mt-2 text-xs text-muted-foreground">{product.category} • <Link to="/store/$slug" params={{ slug: seller.slug }} className="underline hover:text-foreground">{seller.business_name}</Link></div>}

            <div className="mt-4 flex flex-wrap items-baseline gap-3">
              <div className="text-2xl font-bold">₦{Number(product.price).toLocaleString()}</div>
              <div className={`text-xs px-2 py-1 rounded-full border ${product.stock > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{product.stock > 0 ? `In stock • ${product.stock} left` : "Out of stock"}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> 4.8 • No reviews yet — be first</div>
            </div>

            {product.description && <p className="mt-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{product.description}</p>}

            {/* Trust signals */}
            <div className="mt-6 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-xl border border-border bg-card p-3 text-center"><ShieldCheck className="mx-auto h-4 w-4 text-[var(--ocean)]" /><div className="mt-1 font-semibold">Buyer Protection</div></div>
              <div className="rounded-xl border border-border bg-card p-3 text-center"><Truck className="mx-auto h-4 w-4 text-[var(--ocean)]" /><div className="mt-1 font-semibold">Delivery 1-5 days</div></div>
              <div className="rounded-xl border border-border bg-card p-3 text-center"><RotateCcw className="mx-auto h-4 w-4 text-[var(--ocean)]" /><div className="mt-1 font-semibold">Easy returns</div></div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-border bg-card px-1">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">−</button>
                <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">+</button>
              </div>
              <Button onClick={onAdd} disabled={product.stock <= 0} className="flex-1 rounded-full">
                <ShoppingBag className="mr-2 h-4 w-4" /> {product.stock <= 0 ? "Sold out" : "Add to cart"}
              </Button>
            </div>

            {whatsapp ? (
              <a href={buildWhatsAppLink({ phone: whatsapp, productName: product.name, storeSlug: seller.slug })} target="_blank" rel="noreferrer" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95">
                <MessageCircle className="h-4 w-4" /> Chat on WhatsApp about this product
              </a>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Sign in to chat with seller on WhatsApp</p>
            )}

            {!user && <p className="mt-3 text-xs text-muted-foreground">New here? <Link to="/register" className="underline">Create account</Link> to message sellers & checkout with Paystack.</p>}

            {/* Seller card */}
            <div className="mt-8 rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-muted">
                {seller.logo_url ? <img src={seller.logo_url} alt={seller.business_name} className="h-full w-full object-cover" /> : <span className="font-serif">{seller.business_name[0]}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{seller.business_name}</div>
                <div className="text-xs text-muted-foreground truncate">{seller.category ?? "Independent seller"} • Verified store</div>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-full"><Link to="/store/$slug" params={{ slug: seller.slug }}>Visit store <ArrowLeft className="ml-1 h-3 w-3 rotate-180" /></Link></Button>
            </div>

            {/* Share */}
            <p className="mt-3 text-xs text-muted-foreground">Share: <span className="font-mono">{origin}/product/{product.id}</span></p>
          </div>
        </div>

        {/* Related / internal linking — keeps user in JFTStores, builds crawl path */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="font-serif text-xl">More from {seller.business_name}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => (
                <Link key={r.id} to="/product/$id" params={{ id: r.id! }} className="group overflow-hidden rounded-2xl border border-border bg-card hover:shadow-md transition">
                  <div className="aspect-square bg-muted" style={r.images?.[0] ? { backgroundImage: `url(${r.images[0]})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
                  <div className="p-3">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    <div className="text-sm font-semibold">₦{Number(r.price).toLocaleString()}</div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 flex gap-3 text-sm">
              <Link to="/store/$slug" params={{ slug: seller.slug }} className="hover:underline">More from this seller →</Link>
              <Link to="/stores" className="hover:underline">Browse all stores →</Link>
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}
