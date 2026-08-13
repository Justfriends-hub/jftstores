import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/search";

export const Route = createFileRoute("/admin/orders")({ component: OrdersPage });

type Order = {
  id: string; customer_email: string; customer_name: string | null;
  total_amount: number; status: string; created_at: string;
};
const PAGE_SIZE = 30;

function OrdersPage() {
  const [rows, setRows] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => { void load(); }, [page, status, q]);

  async function load() {
    setLoading(true);
    let qb = supabase
      .from("orders")
      .select("id, customer_email, customer_name, total_amount, status, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (status) qb = qb.eq("status", status as "pending");
    const term = sanitizeSearchTerm(q);
    if (term) qb = qb.or(`customer_email.ilike.%${term}%,customer_name.ilike.%${term}%`);
    const { data, count } = await qb;
    setRows((data ?? []) as Order[]);
    setTotal(count ?? 0);
    setLoading(false);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl">Orders</h1>
          <p className="text-sm text-muted-foreground">{total} total.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Search customer…" value={q} onChange={(e) => { setPage(0); setQ(e.target.value); }} className="w-60" />
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }}>
            <option value="">All statuses</option>
            <option value="pending">pending</option>
            <option value="paid">paid</option>
            <option value="shipped">shipped</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
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
                  <TableHead>When</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-xs">{new Date(o.created_at).toLocaleString()}</TableCell>
                    <TableCell>{o.customer_name || o.customer_email}<div className="text-xs text-muted-foreground">{o.customer_email}</div></TableCell>
                    <TableCell><Badge variant="secondary">{o.status}</Badge></TableCell>
                    <TableCell className="text-right">€{Number(o.total_amount).toFixed(2)}</TableCell>
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
