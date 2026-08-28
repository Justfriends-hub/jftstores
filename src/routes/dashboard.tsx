import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { PageShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ProductManager } from "@/components/dashboard/product-manager";
import { StoreSettings } from "@/components/dashboard/store-settings";
import { SellerMessages } from "@/components/dashboard/seller-messages";
import { useUnreadMessages } from "@/lib/use-unread";
import { UnreadBadge } from "@/components/unread-badge";
import { useOnboarding } from "@/lib/onboarding";
import { GlassOnboarding } from "@/components/onboarding/glass-onboarding";
import { PackagePlus, Palette, MessageSquare, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Seller dashboard — JFT STORES — MARKETPLACE" },
      { name: "description", content: "Manage your products, store theme, orders, and buyer messages." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Seller dashboard — JFT STORES — MARKETPLACE" },
      { property: "og:description", content: "Manage your products, store theme, orders, and buyer messages." },
    ],
  }),
  component: DashboardPage,
});

type Seller = {
  id: string; user_id: string; business_name: string; slug: string; status: string;
  description: string | null; whatsapp_number: string | null;
  logo_url: string | null; banner_url: string | null; theme_id: string | null;
};
type OrderItem = {
  id: string; product_name: string; quantity: number;
  price_at_purchase: number; fulfilled: boolean; created_at: string; order_id: string;
};

function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [ready, setReady] = useState(false);
  const { sellerTotal } = useUnreadMessages();

  const loadSeller = useCallback(async (uid: string) => {
    const { data: s } = await supabase
      .from("sellers")
      .select("id, user_id, business_name, slug, status, description, whatsapp_number, logo_url, banner_url, theme_id")
      .eq("user_id", uid)
      .maybeSingle();
    if (!s) { navigate({ to: "/sell", replace: true }); return null; }
    setSeller(s as Seller);
    const { data: oi } = await supabase
      .from("order_items")
      .select("id, product_name, quantity, price_at_purchase, fulfilled, created_at, order_id")
      .eq("seller_id", s.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((oi ?? []) as OrderItem[]);
    setReady(true);
    return s as Seller;
  }, [navigate]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    void loadSeller(user.id);
  }, [user, loading, navigate, loadSeller]);

  async function toggleFulfilled(it: OrderItem) {
    const { error } = await supabase
      .from("order_items")
      .update({ fulfilled: !it.fulfilled })
      .eq("id", it.id);
    if (!error) setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, fulfilled: !x.fulfilled } : x));
  }

  if (loading || !ready) return <PageShell><div className="mx-auto max-w-5xl px-4 py-12">Loading…</div></PageShell>;
  if (!seller) return null;

  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-6">
        <DashboardOnboarding sellerStatus={seller.status} />
        <header className="relative overflow-hidden rounded-[20px] border border-white/50 bg-white/70 backdrop-blur-xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="grid h-16 w-16 sm:h-20 sm:w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted ring-1 ring-border">
              {seller.logo_url ? (
                <img src={seller.logo_url} alt={seller.business_name} className="h-full w-full object-cover" />
              ) : (
                <span className="font-serif text-2xl text-muted-foreground">{seller.business_name[0]}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl sm:text-3xl truncate">{seller.business_name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Status: <Badge variant={seller.status === "approved" ? "default" : "secondary"}>{seller.status}</Badge>
              </p>
              {seller.status !== "approved" && (
                <p className="mt-2 text-xs text-green-700 dark:text-green-400">✓ Your store is active and joining the highly recommended community — you'll be live momentarily. Add products and customise now so you launch strong.</p>
              )}
            </div>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/store/$slug" params={{ slug: seller.slug }}>View storefront</Link>
          </Button>
        </header>

        <Tabs defaultValue={typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "messages" ? "messages" : "products"} className="w-full">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="settings">Store & theme</TabsTrigger>
            <TabsTrigger value="messages" className="gap-2">
              Messages
              <UnreadBadge count={sellerTotal} />
            </TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            <ProductManager sellerId={seller.id} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <StoreSettings seller={seller} onChange={() => user && loadSeller(user.id)} />
          </TabsContent>

          <TabsContent value="messages" className="mt-6">
            <h2 className="font-serif text-xl mb-3">Customer messages</h2>
            <SellerMessages initialOpen={typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("c") : null} />
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <h2 className="font-serif text-xl mb-3">Recent orders ({items.length})</h2>
            {items.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No orders yet.</CardContent></Card>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between px-4 py-3 text-sm gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{it.product_name}</p>
                      <p className="text-xs text-muted-foreground">× {it.quantity} · ₦{(Number(it.price_at_purchase) * it.quantity).toLocaleString()} · {new Date(it.created_at).toLocaleDateString()}</p>
                    </div>
                    <Button size="sm" variant={it.fulfilled ? "ghost" : "outline"} onClick={() => toggleFulfilled(it)}>
                      {it.fulfilled ? "Fulfilled ✓" : "Mark fulfilled"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </PageShell>
  );
}

function DashboardOnboarding({ sellerStatus }: { sellerStatus: string }) {
  const key = `onboarding.dashboard.${sellerStatus}.v2`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) setTimeout(() => setOpen(true), 800);
    } catch { setOpen(true); }
  }, [key]);
  const complete = () => {
    try { localStorage.setItem(key, "1"); } catch {}
    setOpen(false);
  };
  const steps = sellerStatus === "approved"
    ? [
        { icon: <PackagePlus className="h-6 w-6" />, eyebrow: "Dashboard", title: "You're live! Highly Recommended", desc: "You're part of the active community — verified, live and highly recommended. Keep it fresh — add products weekly and stay top-ranked.", accent: "linear-gradient(135deg, oklch(0.85 0.14 85), oklch(0.90 0.12 75))", bullet: ["Add products weekly", "Orders update fulfillment", "Messages = negotiation + brand recall"] },
        { icon: <Palette className="h-6 w-6" />, eyebrow: "Theme", title: "Make it yours", desc: "Store & theme tab — banner, logo, palette. Scoped CSS, live preview.", accent: "linear-gradient(135deg, oklch(0.82 0.16 40), oklch(0.85 0.14 85))" },
        { icon: <MessageSquare className="h-6 w-6" />, eyebrow: "Messages", title: "Never miss a chat", desc: "Customers message from your storefront. Reply fast — WhatsApp fallback is built in.", accent: "linear-gradient(135deg, oklch(0.88 0.13 250), oklch(0.92 0.10 85))" },
        { icon: <ShoppingBag className="h-6 w-6" />, eyebrow: "Orders", title: "Fulfill in one click", desc: "Recent orders grouped by store. Mark fulfilled, track revenue.", accent: "linear-gradient(135deg, oklch(0.90 0.12 150), oklch(0.88 0.13 250))" },
      ]
    : [
        { icon: <PackagePlus className="h-6 w-6" />, eyebrow: "Almost live", title: "Finish setup — you're joining the active community", desc: "You're about to go live in our highly recommended marketplace. Get RAG-ready on day one.", accent: "linear-gradient(135deg, oklch(0.88 0.13 250), oklch(0.92 0.10 85))", bullet: ["Add 3-5 products with photos", "Set WhatsApp number", "Pick a theme"] },
      ];
  return <GlassOnboarding open={open} steps={steps as any} ctaLabel="Go to products" onComplete={complete} onSkip={complete} />;
}
