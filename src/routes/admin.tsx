import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Son of Sun Greece" }] }),
  component: AdminPage,
});

type Seller = { id: string; business_name: string; slug: string; status: string; created_at: string; user_id: string };
type Order = { id: string; customer_email: string; customer_name: string | null; total_amount: number; status: string; created_at: string };
type Product = { id: string; name: string; price: number; is_active: boolean; seller_id: string };

function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    if (!isAdmin) { setReady(true); return; }
    void load();
  }, [user, loading, isAdmin, navigate]);

  async function load() {
    const [{ data: s }, { data: o }, { data: p }] = await Promise.all([
      supabase.from("sellers").select("id,business_name,slug,status,created_at,user_id").order("created_at", { ascending: false }),
      supabase.from("orders").select("id,customer_email,customer_name,total_amount,status,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("products").select("id,name,price,is_active,seller_id").order("created_at", { ascending: false }).limit(200),
    ]);
    setSellers((s ?? []) as Seller[]);
    setOrders((o ?? []) as Order[]);
    setProducts((p ?? []) as Product[]);
    setReady(true);
  }

  async function setSellerStatus(id: string, status: "approved" | "rejected" | "pending") {
    const { error } = await supabase.from("sellers").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Seller ${status}`);
    void load();
  }

  if (loading || !ready) return <PageShell><div className="mx-auto max-w-6xl px-4 py-12">Loading…</div></PageShell>;
  if (!isAdmin) {
    return (
      <PageShell>
        <section className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="font-serif text-2xl">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have permission to view the admin panel.</p>
          <Button asChild className="mt-6 rounded-full"><Link to="/">Back home</Link></Button>
        </section>
      </PageShell>
    );
  }

  const pending = sellers.filter((s) => s.status === "pending");

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 space-y-12">
        <header>
          <h1 className="font-serif text-3xl">Admin panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Approve sellers, review orders and oversee products.</p>
        </header>

        <div>
          <h2 className="font-serif text-xl">Pending approvals ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing waiting.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {pending.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{s.business_name}</div>
                    <div className="text-xs text-muted-foreground">/store/{s.slug}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setSellerStatus(s.id, "approved")}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => setSellerStatus(s.id, "rejected")}>Reject</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="font-serif text-xl">All sellers ({sellers.length})</h2>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {sellers.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{s.business_name}</div>
                  <div className="text-xs text-muted-foreground">/store/{s.slug}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={s.status === "approved" ? "default" : "secondary"}>{s.status}</Badge>
                  {s.status !== "approved" && <Button size="sm" variant="ghost" onClick={() => setSellerStatus(s.id, "approved")}>Approve</Button>}
                  {s.status !== "rejected" && <Button size="sm" variant="ghost" onClick={() => setSellerStatus(s.id, "rejected")}>Reject</Button>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-serif text-xl">Recent orders ({orders.length})</h2>
          {orders.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{o.customer_name ?? o.customer_email}</div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{o.status}</Badge>
                    <span>€{Number(o.total_amount).toFixed(2)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="font-serif text-xl">Products ({products.length})</h2>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">€{Number(p.price).toFixed(2)} · {p.is_active ? "active" : "hidden"}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PageShell>
  );
}
