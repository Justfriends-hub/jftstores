import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/users/$id")({
  component: UserDetailPage,
});

type Profile = {
  id: string; email: string | null; full_name: string | null; whatsapp_number: string | null;
  is_blocked: boolean; referral_store_slug: string | null;
  ip_country: string | null; ip_region: string | null; ip_city: string | null;
  created_at: string; last_active_at: string | null;
};
type Order = { id: string; total_amount: number; status: string; created_at: string };
type Visit = { id: string; page_url: string; store_slug: string | null; visited_at: string; city: string | null; country: string | null };

function UserDetailPage() {
  const { id } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [storesVisited, setStoresVisited] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: o }, { data: v }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("orders").select("id, total_amount, status, created_at").eq("customer_id", id).order("created_at", { ascending: false }),
        supabase.from("page_visits").select("id, page_url, store_slug, visited_at, city, country").eq("user_id", id).order("visited_at", { ascending: false }).limit(100),
        supabase.from("user_roles").select("role").eq("user_id", id),
      ]);
      setProfile(p as Profile | null);
      setOrders((o ?? []) as Order[]);
      setVisits((v ?? []) as Visit[]);
      setRoles((r ?? []).map((x) => x.role as string));
      const slugs = Array.from(new Set((v ?? []).map((x) => x.store_slug).filter(Boolean))) as string[];
      setStoresVisited(slugs);
    })();
  }, [id]);

  if (!profile) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/users" className="text-xs text-muted-foreground hover:underline">← All users</Link>
        <h1 className="font-serif text-2xl mt-1">{profile.full_name || profile.email}</h1>
        <p className="text-sm text-muted-foreground">{profile.email} · {profile.whatsapp_number || "no whatsapp"}</p>
        <div className="mt-2 flex gap-2">
          {roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
          {profile.is_blocked && <Badge variant="destructive">blocked</Badge>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Location (from IP)</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {profile.ip_city || profile.ip_region || profile.ip_country
              ? <>{[profile.ip_city, profile.ip_region, profile.ip_country].filter(Boolean).join(", ")}</>
              : <span className="text-muted-foreground">Unknown</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Referral store</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {profile.referral_store_slug
              ? <Link to="/store/$slug" params={{ slug: profile.referral_store_slug }} className="hover:underline">/store/{profile.referral_store_slug}</Link>
              : <span className="text-muted-foreground">Direct / homepage</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Last active</CardTitle></CardHeader>
          <CardContent className="text-sm">{profile.last_active_at ? new Date(profile.last_active_at).toLocaleString() : "—"}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Stores visited ({storesVisited.length})</CardTitle></CardHeader>
        <CardContent>
          {storesVisited.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {storesVisited.map((s) => (
                <Button key={s} size="sm" variant="outline" asChild>
                  <Link to="/store/$slug" params={{ slug: s }}>/store/{s}</Link>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Orders ({orders.length})</CardTitle></CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders.</p>
          ) : (
            <ul className="divide-y">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{new Date(o.created_at).toLocaleString()}</span>
                  <span className="flex items-center gap-3">
                    <Badge variant="secondary">{o.status}</Badge>
                    <span>€{Number(o.total_amount).toFixed(2)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent visits ({visits.length})</CardTitle></CardHeader>
        <CardContent>
          {visits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracked visits.</p>
          ) : (
            <ul className="divide-y text-sm">
              {visits.slice(0, 25).map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs">{v.page_url}</span>
                  <span className="text-xs text-muted-foreground">{[v.city, v.country].filter(Boolean).join(", ") || "—"} · {new Date(v.visited_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
