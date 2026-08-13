import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { deleteUser, setUserBlocked, promoteToSeller } from "@/lib/admin.functions";
import { sanitizeSearchTerm } from "@/lib/search";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

type Row = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_blocked: boolean;
  referral_store_slug: string | null;
  ip_country: string | null;
  ip_city: string | null;
  created_at: string;
  last_active_at: string | null;
  roles: string[];
  orders_count: number;
};

const PAGE_SIZE = 25;

function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [confirm, setConfirm] = useState<{ type: "block" | "unblock" | "promote" | "delete"; user: Row } | null>(null);

  const block = useServerFn(setUserBlocked);
  const promote = useServerFn(promoteToSeller);
  const del = useServerFn(deleteUser);

  useEffect(() => { void load(); }, [page, q, country]);

  async function load() {
    setLoading(true);
    let qb = supabase
      .from("profiles")
      .select("id, email, full_name, is_blocked, referral_store_slug, ip_country, ip_city, created_at, last_active_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    const term = sanitizeSearchTerm(q);
    if (term) qb = qb.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
    if (country) qb = qb.eq("ip_country", country);

    const { data, count } = await qb;
    const profiles = (data ?? []) as Omit<Row, "roles" | "orders_count">[];
    setTotal(count ?? 0);

    if (profiles.length === 0) { setRows([]); setLoading(false); return; }

    const ids = profiles.map((p) => p.id);
    const [{ data: roleRows }, { data: orderRows }] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      supabase.from("orders").select("customer_id").in("customer_id", ids),
    ]);
    const rolesByUser = new Map<string, string[]>();
    (roleRows ?? []).forEach((r) => {
      rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);
    });
    const ordersByUser = new Map<string, number>();
    (orderRows ?? []).forEach((o) => {
      if (o.customer_id) ordersByUser.set(o.customer_id, (ordersByUser.get(o.customer_id) ?? 0) + 1);
    });

    setRows(profiles.map((p) => ({
      ...p,
      roles: rolesByUser.get(p.id) ?? [],
      orders_count: ordersByUser.get(p.id) ?? 0,
    })));
    setLoading(false);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const countries = useMemo(() => Array.from(new Set(rows.map((r) => r.ip_country).filter(Boolean))) as string[], [rows]);

  async function runAction() {
    if (!confirm) return;
    try {
      if (confirm.type === "block") await block({ data: { userId: confirm.user.id, blocked: true } });
      if (confirm.type === "unblock") await block({ data: { userId: confirm.user.id, blocked: false } });
      if (confirm.type === "promote") await promote({ data: { userId: confirm.user.id } });
      if (confirm.type === "delete") await del({ data: { userId: confirm.user.id } });
      toast.success("Done");
      setConfirm(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl">Users</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} registered.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Search name or email…" value={q} onChange={(e) => { setPage(0); setQ(e.target.value); }} className="w-60" />
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={country} onChange={(e) => { setPage(0); setCountry(e.target.value); }}>
            <option value="">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Referral store</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Link to="/admin/users/$id" params={{ id: u.id }} className="font-medium hover:underline">
                        {u.full_name || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{[u.ip_city, u.ip_country].filter(Boolean).join(", ") || "—"}</TableCell>
                    <TableCell className="text-xs">{u.referral_store_slug || "—"}</TableCell>
                    <TableCell className="text-right">{u.orders_count}</TableCell>
                    <TableCell className="text-xs">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {u.is_blocked ? <Badge variant="destructive">blocked</Badge> : <Badge variant="outline">active</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {u.is_blocked ? (
                          <Button size="sm" variant="ghost" onClick={() => setConfirm({ type: "unblock", user: u })}>Unblock</Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setConfirm({ type: "block", user: u })}>Block</Button>
                        )}
                        {!u.roles.includes("seller") && (
                          <Button size="sm" variant="ghost" onClick={() => setConfirm({ type: "promote", user: u })}>Promote</Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm({ type: "delete", user: u })}>Delete</Button>
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

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {confirm?.type}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "delete"
                ? `Permanently delete ${confirm.user.email}? This cannot be undone.`
                : `Apply "${confirm?.type}" to ${confirm?.user.email}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runAction}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
