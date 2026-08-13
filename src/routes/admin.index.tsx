import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Overview — Admin" },
      { name: "description", content: "Admin command center for Lawal's Marketplace: live visits, stores, orders and revenue at a glance." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OverviewPage,
});

type Kpis = {
  visitsAll: number;
  visitsToday: number;
  users: number;
  stores: number;
  orders: number;
  revenue: number;
  topStore: { name: string; revenue: number } | null;
  topVisited: { name: string; count: number } | null;
};

type Activity = { type: "signup" | "order" | "visit"; text: string; at: string };
type CountryRow = { country: string; count: number };

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function OverviewPage() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const today = startOfTodayISO();
    const [
      { count: visitsAll },
      { count: visitsToday },
      { count: usersC },
      { count: storesC },
      { count: ordersC },
      { data: orderTotals },
      { data: sellersAgg },
      { data: visitsAgg },
      { data: recentUsers },
      { data: recentOrders },
      { data: recentVisits },
      { data: countryRows },
    ] = await Promise.all([
      supabase.from("page_visits").select("id", { count: "exact", head: true }),
      supabase.from("page_visits").select("id", { count: "exact", head: true }).gte("visited_at", today),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("sellers").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("total_amount"),
      supabase.from("sellers").select("id, business_name, total_revenue").order("total_revenue", { ascending: false }).limit(1),
      supabase.from("page_visits").select("store_slug").gte("visited_at", today).not("store_slug", "is", null).limit(5000),
      supabase.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("orders").select("id, customer_email, total_amount, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("page_visits").select("id, store_slug, country, city, visited_at").order("visited_at", { ascending: false }).limit(8),
      supabase.from("page_visits").select("country").not("country", "is", null).limit(5000),
    ]);

    const revenue = (orderTotals ?? []).reduce((n, o) => n + Number(o.total_amount), 0);
    const topStore = sellersAgg?.[0]
      ? { name: sellersAgg[0].business_name, revenue: Number(sellersAgg[0].total_revenue ?? 0) }
      : null;

    // Most visited store today
    const slugCounts = new Map<string, number>();
    (visitsAgg ?? []).forEach((v) => {
      if (v.store_slug) slugCounts.set(v.store_slug, (slugCounts.get(v.store_slug) ?? 0) + 1);
    });
    const topSlug = [...slugCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    let topVisited: Kpis["topVisited"] = null;
    if (topSlug) {
      const { data: s } = await supabase.from("sellers").select("business_name").eq("slug", topSlug[0]).maybeSingle();
      topVisited = { name: s?.business_name ?? topSlug[0], count: topSlug[1] };
    }

    setKpis({
      visitsAll: visitsAll ?? 0,
      visitsToday: visitsToday ?? 0,
      users: usersC ?? 0,
      stores: storesC ?? 0,
      orders: ordersC ?? 0,
      revenue,
      topStore,
      topVisited,
    });

    // Activity feed
    const feed: Activity[] = [];
    (recentUsers ?? []).forEach((u) =>
      feed.push({ type: "signup", text: `New signup: ${u.full_name || u.email}`, at: u.created_at }),
    );
    (recentOrders ?? []).forEach((o) =>
      feed.push({ type: "order", text: `Order €${Number(o.total_amount).toFixed(2)} by ${o.customer_email}`, at: o.created_at }),
    );
    (recentVisits ?? []).forEach((v) =>
      feed.push({
        type: "visit",
        text: `Visit ${v.store_slug ? `/store/${v.store_slug}` : "—"} from ${v.city || v.country || "?"}`,
        at: v.visited_at,
      }),
    );
    feed.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    setActivity(feed.slice(0, 15));

    // Country breakdown
    const cc = new Map<string, number>();
    (countryRows ?? []).forEach((r) => {
      if (r.country) cc.set(r.country, (cc.get(r.country) ?? 0) + 1);
    });
    setCountries([...cc.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count).slice(0, 10));
  }

  if (!kpis) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Command center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live view of the entire platform.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Page visits (all time)" value={kpis.visitsAll.toLocaleString()} sub={`${kpis.visitsToday.toLocaleString()} today`} />
        <Stat label="Registered users" value={kpis.users.toLocaleString()} />
        <Stat label="Active stores" value={kpis.stores.toLocaleString()} />
        <Stat label="Orders placed" value={kpis.orders.toLocaleString()} />
        <Stat label="Revenue processed" value={`€${kpis.revenue.toFixed(2)}`} />
        <Stat
          label="Top selling store"
          value={kpis.topStore?.name ?? "—"}
          sub={kpis.topStore ? `€${kpis.topStore.revenue.toFixed(2)}` : undefined}
        />
        <Stat
          label="Most visited today"
          value={kpis.topVisited?.name ?? "—"}
          sub={kpis.topVisited ? `${kpis.topVisited.count} visits` : undefined}
        />
        <Stat label="Countries reached" value={countries.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="space-y-2">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 text-sm">
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary" className="capitalize">{a.type}</Badge>
                      <span>{a.text}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.at).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Traffic by country</CardTitle>
          </CardHeader>
          <CardContent>
            {countries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No geolocated traffic yet. (Tracking activates as visitors browse.)</p>
            ) : (
              <ul className="space-y-2">
                {countries.map((c) => {
                  const max = countries[0].count;
                  return (
                    <li key={c.country} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span>{c.country}</span>
                        <span className="text-muted-foreground">{c.count.toLocaleString()}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${(c.count / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-4 text-right">
              <Link to="/admin/analytics" className="text-xs text-primary hover:underline">Full analytics →</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
