import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/analytics")({ component: AnalyticsPage });

type Range = "day" | "week" | "month";
type DayRow = { date: string; visits: number; unique: number };
type SourceRow = { name: string; value: number };
type GeoRow = { country: string | null; region: string | null; city: string | null; count: number };
type JourneyRow = { from: string; to: string; count: number };

function classifySource(ref: string | null): string {
  if (!ref) return "Direct";
  if (/whatsapp|wa\.me/i.test(ref)) return "WhatsApp";
  if (/google|bing|duckduckgo/i.test(ref)) return "Search";
  if (/facebook|instagram|twitter|tiktok|t\.co/i.test(ref)) return "Social";
  if (/\/store\//.test(ref)) return "Cross-store";
  return "Other";
}

const COLORS = ["#0ea5e9", "#f97316", "#22c55e", "#a855f7", "#ef4444", "#64748b"];

function AnalyticsPage() {
  const [range, setRange] = useState<Range>("week");
  const [series, setSeries] = useState<DayRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [geo, setGeo] = useState<GeoRow[]>([]);
  const [journeys, setJourneys] = useState<JourneyRow[]>([]);
  const [referralBoard, setReferralBoard] = useState<{ store: string; users: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, [range]);

  async function load() {
    setLoading(true);
    const days = range === "day" ? 1 : range === "week" ? 7 : 30;
    const since = new Date(Date.now() - days * 86400 * 1000).toISOString();

    const [{ data: visits }, { data: journeysData }, { data: profiles }] = await Promise.all([
      supabase.from("page_visits").select("visited_at, session_id, referrer, country, region, city").gte("visited_at", since).limit(20000),
      supabase.from("user_journeys").select("from_store_slug, to_store_slug, to_page").gte("created_at", since).not("from_store_slug", "is", null).limit(10000),
      supabase.from("profiles").select("referral_store_slug").not("referral_store_slug", "is", null).limit(5000),
    ]);

    // Time series
    const byDay = new Map<string, { visits: number; sessions: Set<string> }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400 * 1000).toISOString().slice(0, 10);
      byDay.set(d, { visits: 0, sessions: new Set() });
    }
    (visits ?? []).forEach((v) => {
      const d = v.visited_at.slice(0, 10);
      const entry = byDay.get(d) ?? { visits: 0, sessions: new Set() };
      entry.visits++;
      if (v.session_id) entry.sessions.add(v.session_id);
      byDay.set(d, entry);
    });
    setSeries(Array.from(byDay.entries()).map(([date, e]) => ({ date: date.slice(5), visits: e.visits, unique: e.sessions.size })));

    // Sources
    const src = new Map<string, number>();
    (visits ?? []).forEach((v) => {
      const k = classifySource(v.referrer);
      src.set(k, (src.get(k) ?? 0) + 1);
    });
    setSources(Array.from(src.entries()).map(([name, value]) => ({ name, value })));

    // Geo
    const geoMap = new Map<string, GeoRow>();
    (visits ?? []).forEach((v) => {
      if (!v.country) return;
      const key = `${v.country}|${v.region ?? ""}|${v.city ?? ""}`;
      const e = geoMap.get(key) ?? { country: v.country, region: v.region, city: v.city, count: 0 };
      e.count++;
      geoMap.set(key, e);
    });
    setGeo(Array.from(geoMap.values()).sort((a, b) => b.count - a.count).slice(0, 25));

    // Cross-store journeys
    const jMap = new Map<string, number>();
    (journeysData ?? []).forEach((j) => {
      const to = j.to_store_slug ? `/store/${j.to_store_slug}` : j.to_page ?? "?";
      const key = `${j.from_store_slug}→${to}`;
      jMap.set(key, (jMap.get(key) ?? 0) + 1);
    });
    setJourneys(
      Array.from(jMap.entries())
        .map(([k, count]) => { const [from, to] = k.split("→"); return { from, to, count }; })
        .sort((a, b) => b.count - a.count).slice(0, 25),
    );

    // Referral leaderboard
    const refMap = new Map<string, number>();
    (profiles ?? []).forEach((p) => {
      if (p.referral_store_slug) refMap.set(p.referral_store_slug, (refMap.get(p.referral_store_slug) ?? 0) + 1);
    });
    setReferralBoard(Array.from(refMap.entries()).map(([store, users]) => ({ store, users })).sort((a, b) => b.users - a.users).slice(0, 20));

    setLoading(false);
  }

  if (loading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl">Analytics</h1>
          <p className="text-sm text-muted-foreground">Platform-wide traffic, sources, geography and journeys.</p>
        </div>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={range} onChange={(e) => setRange(e.target.value as Range)}>
          <option value="day">Last 24 hours</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Visits over time</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="visits" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="unique" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Traffic sources</CardTitle></CardHeader>
          <CardContent className="h-72">
            {sources.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {sources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top locations</CardTitle></CardHeader>
          <CardContent>
            {geo.length === 0 ? <p className="text-sm text-muted-foreground">No geolocated traffic yet.</p> : (
              <ul className="text-sm divide-y max-h-72 overflow-y-auto">
                {geo.map((g, i) => (
                  <li key={i} className="flex justify-between py-1.5">
                    <span>{[g.city, g.region, g.country].filter(Boolean).join(", ")}</span>
                    <span className="text-muted-foreground">{g.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Cross-store journeys</CardTitle></CardHeader>
          <CardContent>
            {journeys.length === 0 ? <p className="text-sm text-muted-foreground">No cross-store traffic yet.</p> : (
              <ul className="text-sm divide-y max-h-72 overflow-y-auto">
                {journeys.map((j, i) => (
                  <li key={i} className="flex justify-between py-1.5">
                    <span className="font-mono text-xs">/store/{j.from} → {j.to}</span>
                    <span className="text-muted-foreground">{j.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Store referral leaderboard</CardTitle></CardHeader>
          <CardContent>
            {referralBoard.length === 0 ? <p className="text-sm text-muted-foreground">No referred signups yet.</p> : (
              <ol className="text-sm divide-y">
                {referralBoard.map((r, i) => (
                  <li key={r.store} className="flex justify-between py-1.5">
                    <span><span className="text-muted-foreground mr-2">#{i + 1}</span>/store/{r.store}</span>
                    <span className="text-muted-foreground">{r.users} signups</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
