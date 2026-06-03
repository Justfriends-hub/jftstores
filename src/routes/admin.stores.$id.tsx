import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/stores/$id")({
  component: StoreDetailPage,
});

type Seller = {
  id: string; business_name: string; slug: string; status: string; category: string | null;
  total_revenue: number; total_orders: number; user_id: string; whatsapp_number: string | null;
};
type Product = { id: string; name: string; price: number; stock: number; is_active: boolean };
type Visit = { id: string; visited_at: string; referrer: string | null; country: string | null; city: string | null; user_id: string | null };
type OrderItem = { id: string; product_name: string; quantity: number; price_at_purchase: number; created_at: string; fulfilled: boolean };

function classifySource(ref: string | null): "WhatsApp" | "Cross-store" | "Search/Direct" | "Internal" {
  if (!ref) return "Search/Direct";
  if (/whatsapp|wa\.me/i.test(ref)) return "WhatsApp";
  if (/\/store\//.test(ref)) return "Cross-store";
  if (/sonofsungreece|jftstores|lovable\.app/i.test(ref)) return "Internal";
  return "Search/Direct";
}

function StoreDetailPage() {
  const { id } = Route.useParams();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [crossStoreCount, setCrossStoreCount] = useState(0);
  const [salesByProduct, setSalesByProduct] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("sellers").select("*").eq("id", id).maybeSingle();
      if (!s) return;
      setSeller(s as Seller);
      const [{ data: p }, { data: v }, { data: oi }, { data: journeys }] = await Promise.all([
        supabase.from("products").select("id, name, price, stock, is_active").eq("seller_id", id).order("created_at", { ascending: false }),
        supabase.from("page_visits").select("id, visited_at, referrer, country, city, user_id").eq("store_slug", s.slug).order("visited_at", { ascending: false }).limit(200),
        supabase.from("order_items").select("id, product_name, quantity, price_at_purchase, created_at, fulfilled, product_id").eq("seller_id", id).order("created_at", { ascending: false }),
        supabase.from("user_journeys").select("id").eq("from_store_slug", s.slug),
      ]);
      setProducts((p ?? []) as Product[]);
      setVisits((v ?? []) as Visit[]);
      setItems((oi ?? []) as OrderItem[]);
      setCrossStoreCount(journeys?.length ?? 0);
      const m = new Map<string, number>();
      ((oi ?? []) as Array<OrderItem & { product_id?: string }>).forEach((row) => {
        const key = row.product_id ?? row.product_name;
        m.set(key, (m.get(key) ?? 0) + row.quantity);
      });
      setSalesByProduct(m);
    })();
  }, [id]);

  if (!seller) return <Skeleton className="h-64 w-full" />;

  const sources = visits.reduce((acc, v) => {
    const k = classifySource(v.referrer);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const uniqueVisitors = new Set(visits.map((v) => v.user_id ?? `${v.country}-${v.city}-${v.referrer}`)).size;
  const totalRevenue = items.reduce((n, it) => n + Number(it.price_at_purchase) * it.quantity, 0);
  const topProduct = products.map((p) => ({ ...p, sold: salesByProduct.get(p.id) ?? 0 })).sort((a, b) => b.sold - a.sold)[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link to="/admin/stores" className="text-xs text-muted-foreground hover:underline">← All stores</Link>
          <h1 className="font-serif text-2xl mt-1">{seller.business_name}</h1>
          <p className="text-sm text-muted-foreground">/store/{seller.slug} · {seller.category || "uncategorized"}</p>
          <Badge variant={seller.status === "approved" ? "default" : "secondary"} className="mt-2">{seller.status}</Badge>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/store/$slug" params={{ slug: seller.slug }}>View storefront</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Unique visitors", v: uniqueVisitors },
          { l: "Total visits", v: visits.length },
          { l: "Cross-store outflow", v: crossStoreCount },
          { l: "Revenue", v: `€${totalRevenue.toFixed(2)}` },
        ].map((s) => (
          <Card key={s.l}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{s.l}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{s.v}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Traffic sources</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(sources).length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : (
              <ul className="space-y-1 text-sm">
                {Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <li key={k} className="flex justify-between"><span>{k}</span><span className="text-muted-foreground">{v}</span></li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top product</CardTitle></CardHeader>
          <CardContent>
            {topProduct ? (
              <div className="text-sm">
                <div className="font-medium">{topProduct.name}</div>
                <div className="text-muted-foreground">Sold {topProduct.sold} units · €{Number(topProduct.price).toFixed(2)} each</div>
              </div>
            ) : <p className="text-sm text-muted-foreground">No sales yet.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Products ({products.length})</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span><span className="font-medium">{p.name}</span> <span className="text-muted-foreground text-xs">stock {p.stock} · {p.is_active ? "active" : "hidden"}</span></span>
                <span className="text-muted-foreground">€{Number(p.price).toFixed(2)} · sold {salesByProduct.get(p.id) ?? 0}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Order items ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
            <ul className="divide-y text-sm">
              {items.slice(0, 30).map((it) => (
                <li key={it.id} className="flex items-center justify-between py-2">
                  <span>{it.product_name} × {it.quantity}</span>
                  <span className="text-muted-foreground">€{(Number(it.price_at_purchase) * it.quantity).toFixed(2)} · {it.fulfilled ? "fulfilled" : "pending"}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent visitors ({visits.length})</CardTitle></CardHeader>
        <CardContent>
          {visits.length === 0 ? <p className="text-sm text-muted-foreground">No tracked visits.</p> : (
            <ul className="divide-y text-sm">
              {visits.slice(0, 30).map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2">
                  <span className="text-xs">{[v.city, v.country].filter(Boolean).join(", ") || "unknown"}</span>
                  <span className="text-xs text-muted-foreground">{classifySource(v.referrer)} · {new Date(v.visited_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
