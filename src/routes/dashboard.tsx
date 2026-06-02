import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Seller dashboard — Son of Sun Greece" }] }),
  component: DashboardPage,
});

type Seller = { id: string; business_name: string; slug: string; status: string };
type Product = { id: string; name: string; price: number; stock: number; is_active: boolean };
type OrderItem = { id: string; product_name: string; quantity: number; price_at_purchase: number; fulfilled: boolean; created_at: string; order_id: string };

function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    (async () => {
      const { data: s } = await supabase.from("sellers").select("id,business_name,slug,status").eq("user_id", user.id).maybeSingle();
      if (!s) { navigate({ to: "/sell", replace: true }); return; }
      setSeller(s as Seller);
      const [{ data: p }, { data: oi }] = await Promise.all([
        supabase.from("products").select("id,name,price,stock,is_active").eq("seller_id", s.id).order("created_at", { ascending: false }),
        supabase.from("order_items").select("id,product_name,quantity,price_at_purchase,fulfilled,created_at,order_id").eq("seller_id", s.id).order("created_at", { ascending: false }).limit(50),
      ]);
      setProducts((p ?? []) as Product[]);
      setItems((oi ?? []) as OrderItem[]);
      setReady(true);
    })();
  }, [user, loading, navigate]);

  if (loading || !ready) return <PageShell><div className="mx-auto max-w-5xl px-4 py-12">Loading…</div></PageShell>;
  if (!seller) return null;

  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl">{seller.business_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Status: <Badge variant="secondary">{seller.status}</Badge></p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/store/$slug" params={{ slug: seller.slug }}>View storefront</Link>
          </Button>
        </header>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl">Products ({products.length})</h2>
          </div>
          {products.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No products yet. Product creation UI coming soon — contact admin to seed.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {products.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">€{Number(p.price).toFixed(2)} · stock {p.stock} · {p.is_active ? "active" : "hidden"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="font-serif text-xl">Recent orders ({items.length})</h2>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    <span className="font-medium">{it.product_name}</span>
                    <span className="text-muted-foreground"> × {it.quantity}</span>
                  </span>
                  <span className="text-muted-foreground">€{(Number(it.price_at_purchase) * it.quantity).toFixed(2)} · {it.fulfilled ? "fulfilled" : "pending"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </PageShell>
  );
}
