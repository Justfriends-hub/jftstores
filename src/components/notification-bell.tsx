import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/notifications.functions";

type N = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<N[]>([]);
  const [open, setOpen] = useState(false);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, url, type, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as N[]);
  }, [user]);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    void load();
    const ch = supabase
      .channel("notifications-" + user.id)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setItems((prev) => [payload.new as N, ...prev].slice(0, 30))
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, load]);

  if (!user) return null;

  const unread = items.filter((i) => !i.is_read).length;


  async function onClick(n: N) {
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
      try { await markRead({ data: { id: n.id } }); } catch {}
    }
    setOpen(false);
  }

  async function onMarkAll() {
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    try { await markAll({}); } catch {}
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--terracotta)] px-1 text-[10px] font-semibold text-[var(--terracotta-foreground)]">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onMarkAll}>Mark all read</Button>
          )}
        </div>
        {pushState === "off" && (
          <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Get alerts even when the app is closed.</p>
            <Button size="sm" className="h-7 rounded-full text-xs" disabled={busy} onClick={onEnablePush}>
              {busy ? "Enabling…" : "Turn on"}
            </Button>
          </div>
        )}
        {pushState === "blocked" && (
          <p className="border-b bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            Push is blocked in your browser settings. Allow notifications for this site to get offline alerts.
          </p>
        )}

        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet — stay tuned for deals.</p>
          ) : (
            <ul>
              {items.map((n) => {
                const body = (
                  <div className={`px-3 py-2.5 border-b last:border-0 ${!n.is_read ? "bg-muted/40" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.url ? (
                      <Link to={n.url} onClick={() => onClick(n)} className="block hover:bg-muted/30">{body}</Link>
                    ) : (
                      <button onClick={() => onClick(n)} className="w-full text-left hover:bg-muted/30">{body}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
