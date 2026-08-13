import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { setSellerStatus, updateSeller } from "@/lib/admin.functions";
import { sanitizeSearchTerm } from "@/lib/search";

export const Route = createFileRoute("/admin/stores")({
  component: StoresPage,
});

type Store = {
  id: string; business_name: string; slug: string; category: string | null;
  status: string; is_featured: boolean; rank: number;
  total_revenue: number; total_orders: number;
  created_at: string; user_id: string;
  product_count: number; visits: number;
};

type Sort = "newest" | "visits" | "revenue" | "products";
const PAGE_SIZE = 25;

function StoresPage() {
  const [rows, setRows] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const setStatus = useServerFn(setSellerStatus);
  const update = useServerFn(updateSeller);

  useEffect(() => { void load(); }, [page, q, sort]);

  async function load() {
    setLoading(true);
    let qb = supabase
      .from("sellers")
      .select("id, business_name, slug, category, status, is_featured, rank, total_revenue, total_orders, created_at, user_id", { count: "exact" });
    const term = sanitizeSearchTerm(q);
    if (term) qb = qb.or(`business_name.ilike.%${term}%,slug.ilike.%${term}%,category.ilike.%${term}%`);
    if (sort === "newest") qb = qb.order("created_at", { ascending: false });
    if (sort === "revenue") qb = qb.order("total_revenue", { ascending: false });
    qb = qb.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    const { data, count } = await qb;
    const sellers = (data ?? []) as Omit<Store, "product_count" | "visits">[];
    setTotal(count ?? 0);

    if (sellers.length === 0) { setRows([]); setLoading(false); return; }

    const ids = sellers.map((s) => s.id);
    const slugs = sellers.map((s) => s.slug);
    const [{ data: prodCounts }, { data: visitRows }] = await Promise.all([
      supabase.from("products").select("seller_id").in("seller_id", ids),
      supabase.from("page_visits").select("store_slug").in("store_slug", slugs),
    ]);
    const prodMap = new Map<string, number>();
    (prodCounts ?? []).forEach((p) => prodMap.set(p.seller_id, (prodMap.get(p.seller_id) ?? 0) + 1));
    const visitMap = new Map<string, number>();
    (visitRows ?? []).forEach((v) => {
      if (v.store_slug) visitMap.set(v.store_slug, (visitMap.get(v.store_slug) ?? 0) + 1);
    });

    let enriched = sellers.map((s) => ({
      ...s,
      product_count: prodMap.get(s.id) ?? 0,
      visits: visitMap.get(s.slug) ?? 0,
    }));
    if (sort === "visits") enriched = enriched.sort((a, b) => b.visits - a.visits);
    if (sort === "products") enriched = enriched.sort((a, b) => b.product_count - a.product_count);
    setRows(enriched);
    setLoading(false);
  }

  async function act(fn: () => Promise<unknown>) {
    try { await fn(); toast.success("Updated"); void load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl">Stores</h1>
          <p className="text-sm text-muted-foreground">{total} total.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Search…" value={q} onChange={(e) => { setPage(0); setQ(e.target.value); }} className="w-60" />
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="newest">Newest</option>
            <option value="visits">Most visited</option>
            <option value="revenue">Highest revenue</option>
            <option value="products">Most products</option>
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link to="/admin/stores/$id" params={{ id: s.id }} className="font-medium hover:underline">{s.business_name}</Link>
                      <div className="text-xs text-muted-foreground">/store/{s.slug}</div>
                    </TableCell>
                    <TableCell className="text-xs">{s.category || "—"}</TableCell>
                    <TableCell><Badge variant={s.status === "approved" ? "default" : s.status === "suspended" ? "destructive" : "secondary"}>{s.status}</Badge></TableCell>
                    <TableCell className="text-right">{s.product_count}</TableCell>
                    <TableCell className="text-right">{s.visits}</TableCell>
                    <TableCell className="text-right">{s.total_orders}</TableCell>
                    <TableCell className="text-right">€{Number(s.total_revenue).toFixed(2)}</TableCell>
                    <TableCell>
                      <Switch checked={s.is_featured} onCheckedChange={(v) => act(() => update({ data: { sellerId: s.id, patch: { is_featured: v } } }))} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" className="w-16 ml-auto h-8" defaultValue={s.rank}
                        onBlur={(e) => { const v = parseInt(e.target.value); if (v !== s.rank) act(() => update({ data: { sellerId: s.id, patch: { rank: v } } })); }} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {s.status !== "approved" && <Button size="sm" variant="ghost" onClick={() => act(() => setStatus({ data: { sellerId: s.id, status: "approved" } }))}>Approve</Button>}
                        {s.status !== "suspended" && <Button size="sm" variant="ghost" onClick={() => act(() => setStatus({ data: { sellerId: s.id, status: "suspended" } }))}>Suspend</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
