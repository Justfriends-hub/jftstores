import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listSellerConversations } from "@/lib/chat.functions";
import { ChatDrawer } from "@/components/chat/chat-drawer";
import { useUnreadMessages } from "@/lib/use-unread";
import { UnreadBadge } from "@/components/unread-badge";
import { ConversationRowActions } from "@/components/chat/conversation-row-actions";

type Row = {
  id: string;
  customer_id: string;
  status: string;
  last_message_at: string | null;
  product_id: string | null;
  products: { name: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export function SellerMessages({ initialOpen }: { initialOpen?: string | null }) {
  const { user } = useAuth();
  const list = useServerFn(listSellerConversations);
  const { byConversation, refresh: refreshUnread } = useUnreadMessages();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null);

  async function refresh() {
    try {
      const data = await list();
      setRows(data as unknown as Row[]);
    } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`seller-convs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => { void refresh(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => { void refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (loading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>;
  }
  if (rows.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">No customer messages yet.</CardContent></Card>;
  }

  return (
    <>
      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {rows.map((r) => {
          const unread = byConversation[r.id] ?? 0;
          return (
            <li key={r.id} className={`px-4 py-3 ${unread ? "bg-muted/30" : ""}`}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => { setOpenId(r.id); setTimeout(() => { void refreshUnread(); }, 400); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setOpenId(r.id); setTimeout(() => { void refreshUnread(); }, 400); } }}
                className="flex w-full items-center justify-between gap-3 text-left cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`truncate ${unread ? "font-semibold" : "font-medium"}`}>{r.profiles?.full_name || r.profiles?.email || "Customer"}</span>
                    <Badge variant="secondary" className="capitalize text-[10px]">{r.status.replace("_", " ")}</Badge>
                    <UnreadBadge count={unread} />
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.products?.name ? `About: ${r.products.name} · ` : ""}
                    {r.last_message_at ? new Date(r.last_message_at).toLocaleString() : ""}
                  </div>
                </div>
              </div>
              <ConversationRowActions
                conversationId={r.id}
                status={r.status as "active" | "negotiating" | "price_agreed" | "resolved" | "closed"}
                onChanged={() => { void refresh(); void refreshUnread(); }}
              />
            </li>
          );
        })}
      </ul>
      {openId && <ChatDrawer conversationId={openId} onClose={() => { setOpenId(null); void refreshUnread(); }} />}
    </>
  );
}

