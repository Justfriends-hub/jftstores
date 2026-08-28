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
    if (!p || !s) return { meta: [{ title: "Product — JFT STORES — MARKETPLACE" }] };
    const url = `${origin}/product/${params.id}`;
    const title = `${p.name} — ₦${Number(p.price).toLocaleString()} | ${s.business_name} | JFT STORES — MARKETPLACE`;
    const desc = p.description ? `${p.description.slice(0, 155)}` : `Buy ${p.name} from ${s.business_name} on JFT STORES — MARKETPLACE. Highly recommended • WhatsApp ordering • Paystack checkout • Delivery in Nigeria. Join the active community.`;
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
  const { add, items } = useCart();
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [locLagos, setLocLagos] = useState("Lagos");
  const [locArea, setLocArea] = useState("LEKKI-AJAH (SANGOTEDO)");
  const [wish, setWish] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://jftstores.shop";
  const whatsapp = seller.whatsapp_number;
  const inCart = items.find((i) => i.productId === product.id);

  // JUMIA-style pricing: mock strikethrough + flash timer
  const oldPrice = Math.round(Number(product.price) * 1.9);
  const discount = Math.round(((oldPrice - Number(product.price)) / oldPrice) * 100);
  const stockTotal = Math.max(product.stock + 12, 20);
  const stockPct = Math.round((product.stock / stockTotal) * 100);
  const [timeLeft, setTimeLeft] = useState({ h: 6, m: 2, s: 59 });
  // countdown
  useState(() => {
    const id = setInterval(() => {
      setTimeLeft((t) => {
        let { h, m, s } = t;
        if (s > 0) s--;
        else if (m > 0) { m--; s = 59; }
        else if (h > 0) { h--; m = 59; s = 59; }
        else { clearInterval(id); return t; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(id);
  });

  const onAdd = () => {
    add({ productId: product.id, sellerId: seller.id, sellerSlug: seller.slug, sellerName: seller.business_name, sellerWhatsApp: whatsapp, productName: product.name, price: Number(product.price), image: product.images?.[0] ?? null }, qty);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <PageShell>
      <div className="bg-[#f1f1f2] min-h-screen">
        <div className="mx-auto max-w-[1280px] px-3 sm:px-4 py-3">
          {/* Breadcrumb like JUMIA */}
          <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground hover:underline">Home</Link> <span>&gt;</span>
            <span className="hover:text-foreground">{product.category ?? "Category"}</span> <span>&gt;</span>
            <Link to="/store/$slug" params={{ slug: seller.slug }} className="hover:text-foreground hover:underline">{seller.business_name}</Link> <span>&gt;</span>
            <span className="text-foreground truncate max-w-[260px]">{product.name}</span>
          </nav>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_380px] xl:grid-cols-[380px_1fr_320px]">
            {/* LEFT — image card (JUMIA style) */}
            <div className="bg-white rounded-lg border border-black/5 p-3">
              <div className="relative aspect-square overflow-hidden rounded bg-white">
                {/* RENEWED vertical ribbon */}
                <div className="absolute left-0 top-6 z-10 -rotate-90 origin-top-left bg-[#c41e3a] text-white text-[11px] font-bold tracking-widest px-3 py-1">RENEWED</div>
                <button onClick={() => setWish(!wish)} className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white shadow border border-black/5 hover:scale-105 transition">
                  <span className={wish ? "text-orange-500" : "text-muted-foreground"}>♡</span>
                </button>
                {product.images?.[activeImg] ? (
                  <img src={product.images[activeImg]} alt={product.name} className="h-full w-full object-contain" fetchPriority="high" />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">No image</div>
                )}
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {(product.images ?? []).slice(0, 5).map((img, i) => (
                  <button key={i} onClick={() => setActiveImg(i)} className={`h-14 w-14 shrink-0 overflow-hidden rounded border ${i === activeImg ? "border-[#f68b1e] ring-1 ring-[#f68b1e]" : "border-black/10"}`}>
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
                {(!product.images || product.images.length === 0) && <div className="h-14 w-14 rounded border border-dashed grid place-items-center text-xs text-muted-foreground">No</div>}
              </div>
              <div className="mt-4 border-t pt-3">
                <div className="text-xs font-bold tracking-wide">SHARE THIS PRODUCT</div>
                <div className="mt-2 flex gap-2">
                  <a href={`https://wa.me/?text=${encodeURIComponent(origin + "/product/" + product.id)}`} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full border hover:bg-muted">W</a>
                  <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(origin + "/product/" + product.id)}`} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full border hover:bg-muted">f</a>
                  <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(origin + "/product/" + product.id)}`} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full border hover:bg-muted">𝕏</a>
                </div>
              </div>
            </div>

            {/* CENTER — details card (JUMIA style) */}
            <div className="bg-white rounded-lg border border-black/5 p-4">
              <div className="inline-flex rounded bg-[#e8f0fe] text-[#1a73e8] text-[10px] font-bold tracking-widest px-2 py-1">REFURBISHED</div>
              <h1 className="mt-2 text-[18px] sm:text-[20px] leading-tight font-normal text-[#313133]">{product.name}</h1>

              {/* Flash sales bar */}
              <div className="mt-3 flex items-center justify-between rounded bg-[#c41e3a] px-3 py-2 text-white text-xs">
                <span className="inline-flex items-center gap-1 font-bold"><span className="bg-white text-[#c41e3a] rounded-full h-5 w-5 grid place-items-center">⚡</span> Flash Sales</span>
                <span className="font-mono">Time Left: {String(timeLeft.h).padStart(2, "0")}h : {String(timeLeft.m).padStart(2, "0")}m : {String(timeLeft.s).padStart(2, "0")}s</span>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="text-[24px] font-bold text-[#313133]">₦ {Number(product.price).toLocaleString()}</div>
                <div className="text-sm line-through text-muted-foreground">₦ {oldPrice.toLocaleString()}</div>
                <div className="rounded bg-[#fef3e2] text-[#f68b1e] text-xs font-bold px-1.5 py-0.5">-{discount}%</div>
              </div>

              <div className="mt-2">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-[#f68b1e]" style={{ width: `${stockPct}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{product.stock} items in stock</div>
              </div>

              <div className="mt-2 text-xs">+ shipping from <span className="font-bold">₦ 1,000</span> to {locArea.split("(")[0].trim()}</div>

              <div className="mt-2 flex items-center gap-1 text-xs">
                <span className="text-[#f68b1e]">★★★★☆</span> <a href="#reviews" className="text-[#264996] hover:underline">(36 verified ratings)</a>
              </div>

              <div className="mt-4">
                <div className="text-xs font-bold">VARIATION AVAILABLE</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="rounded border border-[#f68b1e] bg-[#fef3e2] px-3 py-1.5 text-xs font-medium text-[#f68b1e]">{product.name.split(" ").slice(0, 3).join(" ")} — ₦{Number(product.price).toLocaleString()}</button>
                  <button className="rounded border border-black/10 px-3 py-1.5 text-xs hover:border-black/20">More variants</button>
                </div>
              </div>

              {/* Qty + Add */}
              <div className="mt-5 flex gap-2">
                <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-1">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">−</button>
                  <span className="w-6 text-center text-sm font-bold">{qty}</span>
                  <button onClick={() => setQty((q) => q + 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">+</button>
                </div>
                {inCart ? (
                  <Button asChild className="flex-1 rounded bg-[#f68b1e] hover:bg-[#e57f1a] text-white"><Link to="/cart">Go to cart ({inCart.quantity})</Link></Button>
                ) : (
                  <Button onClick={onAdd} disabled={product.stock <= 0} className="flex-1 rounded bg-[#f68b1e] hover:bg-[#e57f1a] text-white">
                    <ShoppingBag className="mr-2 h-4 w-4" /> {product.stock <= 0 ? "Sold out" : "Add to cart"}
                  </Button>
                )}
              </div>

              {whatsapp ? (
                <a href={buildWhatsAppLink({ phone: whatsapp, productName: product.name, storeSlug: seller.slug })} target="_blank" rel="noreferrer" className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded bg-[#25D366] py-2.5 text-sm font-bold text-white hover:opacity-95">
                  <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
                </a>
              ) : (
                <Link to="/store/$slug" params={{ slug: seller.slug }} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded border py-2.5 text-sm font-medium hover:bg-muted">
                  <Store className="h-4 w-4" /> Visit {seller.business_name}
                </Link>
              )}

              {product.description && <p className="mt-4 text-sm leading-relaxed text-[#313133] whitespace-pre-wrap">{product.description}</p>}
            </div>

            {/* RIGHT — Delivery & Returns (JUMIA style) */}
            <div className="bg-white rounded-lg border border-black/5 p-4 h-fit lg:sticky lg:top-[72px]">
              <div className="text-xs font-bold tracking-wide">DELIVERY & RETURNS</div>
              <div className="mt-3 rounded border border-[#ffdabf] bg-[#fff8f0] p-2 text-xs leading-tight">
                <div className="font-bold text-[#f68b1e]">JFTStores EXPRESS</div>
                <div className="text-muted-foreground">The BEST products, delivered fast. Now <span className="font-bold">PAY on DELIVERY</span>, Cash or Bank Transfer Anywhere, Zero Wahala!</div>
                <a href="#" className="text-[#264996] hover:underline">Details</a>
              </div>

              <div className="mt-4 text-xs font-bold">Choose your location</div>
              <div className="mt-2 space-y-2">
                <select value={locLagos} onChange={(e) => setLocLagos(e.target.value)} className="w-full rounded border border-black/15 bg-white px-3 py-2.5 text-sm">
                  <option>Lagos</option>
                  <option>Abuja</option>
                  <option>Port Harcourt</option>
                  <option>Ibadan</option>
                </select>
                <select value={locArea} onChange={(e) => setLocArea(e.target.value)} className="w-full rounded border border-black/15 bg-white px-3 py-2.5 text-sm">
                  <option>LEKKI-AJAH (SANGOTEDO)</option>
                  <option>IKEJA</option>
                  <option>YABA</option>
                  <option>VICTORIA ISLAND</option>
                </select>
              </div>

              <div className="mt-4 flex gap-3 rounded border border-black/5 p-3">
                <div className="grid h-8 w-8 place-items-center rounded border bg-white">🏪</div>
                <div className="text-xs leading-tight">
                  <div className="flex items-center gap-2 font-bold">Pickup Station <a href="#" className="text-[#264996] font-normal hover:underline">Details</a></div>
                  <div>Delivery Fees <span className="font-bold">₦ 1,000</span></div>
                  <div className="text-muted-foreground">Ready for pickup between 03 September and 04 September</div>
                </div>
              </div>

              {/* Seller trust */}
              <div className="mt-4 rounded border border-black/5 p-3 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-muted">
                  {seller.logo_url ? <img src={seller.logo_url} alt={seller.business_name} className="h-full w-full object-cover" /> : <span className="font-serif">{seller.business_name[0]}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">{seller.business_name}</div>
                  <div className="text-xs text-muted-foreground">Verified • {seller.category ?? "Seller"}</div>
                </div>
                <Link to="/store/$slug" params={{ slug: seller.slug }} className="text-xs text-[#264996] hover:underline">Visit store</Link>
              </div>
            </div>
          </div>

          {/* Related — keeps crawl graph, not in Jumia image but useful */}
          {related.length > 0 && (
            <div className="mt-4 bg-white rounded-lg border border-black/5 p-4">
              <h2 className="font-bold text-sm">More from {seller.business_name}</h2>
              <div className="mt-3 grid gap-3 grid-cols-2 sm:grid-cols-4">
                {related.map((r) => (
                  <Link key={r.id} to="/product/$id" params={{ id: r.id! }} className="group overflow-hidden rounded border border-black/5 hover:shadow">
                    <div className="aspect-square bg-muted" style={r.images?.[0] ? { backgroundImage: `url(${r.images[0]})`, backgroundSize: "cover" } : undefined} />
                    <div className="p-2">
                      <div className="truncate text-xs">{r.name}</div>
                      <div className="text-sm font-bold">₦{Number(r.price).toLocaleString()}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
