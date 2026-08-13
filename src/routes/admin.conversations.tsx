import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flag, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  adminListConversations,
  adminFlagConversation,
} from "@/lib/chat.functions";
import { ChatDrawer } from "@/components/chat/chat-drawer";

export const Route = createFileRoute("/admin/conversations")({
  head: () => ({ meta: [{ title: "Conversations — Admin" }] }),
  component: AdminConversationsPage,
});

type Row = {
  id: string;
  status: string;
  flagged: boolean | null;
  last_message_at: string | null;
  sellers: { business_name: string; slug: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

function AdminConversationsPage() {
  const list = useServerFn(adminListConversations);
  const flag = useServerFn(adminFlagConversation);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "flagged" | "negotiating" | "price_agreed">("all");
  const [liveAt, setLiveAt] = useState<Date | null>(null);

  async function refresh(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setLoading(true);
    try {
      const data = await list();
      setRows(data as unknown as Row[]);
      setLiveAt(new Date());
    } catch (e) {
      if (!opts.silent) toast.error(e instanceof Error ? e.message : "Could not load");
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  // Admins bypass RLS through the server function, so realtime can't push to
  // them directly. Poll on a short interval instead, and only while the tab is
  // visible so background tabs don't hammer the backend.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => { void refresh({ silent: true }); }, 5000);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVisibility = () => {
      if (document.visibilityState === "visible") { void refresh({ silent: true }); start(); }
      else stop();
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  async function toggleFlag(r: Row) {
    try {
      await flag({ data: { conversationId: r.id, flagged: !r.flagged } });
      setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, flagged: !r.flagged } : x));
      void refresh({ silent: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not flag");
    }
  }


  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "flagged") return !!r.flagged;
    return r.status === filter;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Conversations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitor negotiations and customer/seller chats.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "negotiating", "price_agreed", "flagged"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="rounded-full capitalize"
          >
            {f.replace("_", " ")}
          </Button>
        ))}
      </div>

      {loading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">No conversations.</CardContent></Card>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-background">
          {filtered.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{r.sellers?.business_name ?? "Store"}</span>
                  <span className="text-muted-foreground">↔</span>
                  <span className="truncate">{r.profiles?.full_name || r.profiles?.email || "Customer"}</span>
                  <Badge variant="secondary" className="capitalize">{r.status.replace("_", " ")}</Badge>
                  {r.flagged && <Badge variant="destructive">Flagged</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {r.last_message_at ? new Date(r.last_message_at).toLocaleString() : "—"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setOpenId(r.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> View
                </Button>
                <Button size="sm" variant={r.flagged ? "default" : "outline"} onClick={() => toggleFlag(r)}>
                  <Flag className="h-3.5 w-3.5 mr-1" /> {r.flagged ? "Unflag" : "Flag"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {openId && <ChatDrawer conversationId={openId} onClose={() => setOpenId(null)} readOnly />}
    </div>
  );
}
