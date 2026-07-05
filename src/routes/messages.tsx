import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/site-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { listMyConversationsForCustomer } from "@/lib/chat.functions";
import { ChatDrawer } from "@/components/chat/chat-drawer";
import { useUnreadMessages } from "@/lib/use-unread";
import { UnreadBadge } from "@/components/unread-badge";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — Just Friends Store" }] }),
  component: MessagesPage,
});

type Conv = {
  id: string;
  seller_id: string;
  status: string;
  last_message_at: string | null;
  sellers: { business_name: string; logo_url: string | null; slug: string } | null;
};

function MessagesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const list = useServerFn(listMyConversationsForCustomer);
  const [rows, setRows] = useState<Conv[]>([]);
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { byConversation, customerTotal, refresh: refreshUnread } = useUnreadMessages();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    (async () => {
      try {
        const data = await list();
        setRows(data as unknown as Conv[]);
      } finally { setReady(true); }
    })();
  }, [user, loading, navigate, list]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const c = new URLSearchParams(window.location.search).get("c");
    if (c) setOpenId(c);
  }, []);

  if (loading || !ready) {
    return <PageShell><div className="mx-auto max-w-3xl px-4 py-12">Loading…</div></PageShell>;
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-3xl">Messages</h1>
          <UnreadBadge count={customerTotal} />
        </div>
        {rows.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">No conversations yet. Start chatting from a store page.</CardContent></Card>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-background">
            {rows.map((c) => {
              const unread = byConversation[c.id] ?? 0;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => { setOpenId(c.id); setTimeout(() => { void refreshUnread(); }, 400); }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 ${unread ? "bg-muted/30" : ""}`}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
                      {c.sellers?.logo_url
                        ? <img src={c.sellers.logo_url} alt="" className="h-full w-full object-cover" />
                        : <span className="font-serif text-sm">{c.sellers?.business_name?.[0] ?? "?"}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`truncate ${unread ? "font-semibold" : "font-medium"}`}>{c.sellers?.business_name ?? "Store"}</span>
                        <Badge variant="secondary" className="capitalize text-[10px]">{c.status.replace("_", " ")}</Badge>
                        <UnreadBadge count={unread} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : ""}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {openId && <ChatDrawer conversationId={openId} onClose={() => { setOpenId(null); void refreshUnread(); }} />}
    </PageShell>
  );
}
