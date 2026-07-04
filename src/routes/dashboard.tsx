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

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Seller dashboard — Just Friends Store" }] }),
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
        <header className="flex flex-wrap items-center justify-between gap-3">
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
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Your store isn't public yet — an admin still needs to approve it. You can add products and customise it now so it's ready to go live.</p>
              )}
            </div>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/store/$slug" params={{ slug: seller.slug }}>View storefront</Link>
          </Button>
        </header>

        <Tabs defaultValue="products" className="w-full">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="settings">Store & theme</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            <ProductManager sellerId={seller.id} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <StoreSettings seller={seller} onChange={() => user && loadSeller(user.id)} />
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
