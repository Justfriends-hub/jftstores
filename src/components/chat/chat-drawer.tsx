import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Send, Flag, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  sendMessage,
  sendOffer,
  respondToOffer,
  listMessages,
  getConversationHeader,
  openConversation,
  markConversationRead,
} from "@/lib/chat.functions";

type Msg = {
  id: string;
  sender_id: string | null;
  sender_role: string;
  message_type: string;
  content: string;
  offer_amount: number | null;
  offer_status: string | null;
  negotiation_id: string | null;
  product_id: string | null;
  created_at: string;
};

type Header = {
  id: string;
  customer_id: string;
  seller_id: string;
  product_id: string | null;
  status: string;
  sellers: { id: string; business_name: string; logo_url: string | null; user_id: string } | null;
  products: { id: string; name: string; price: number; images: string[] } | null;
};

export function ChatDrawer({
  conversationId,
  onClose,
  readOnly = false,
}: {
  conversationId: string;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const { user } = useAuth();
  const { items, multiStore } = useCart();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [header, setHeader] = useState<Header | null>(null);
  const [text, setText] = useState("");
  const [offer, setOffer] = useState("");
  const [connected, setConnected] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const sendMsg = useServerFn(sendMessage);
  const sendOfr = useServerFn(sendOffer);
  const respond = useServerFn(respondToOffer);
  const fetchMsgs = useServerFn(listMessages);
  const fetchHeader = useServerFn(getConversationHeader);
  const markRead = useServerFn(markConversationRead);

  const refresh = useCallback(async () => {
    const [h, m] = await Promise.all([
      fetchHeader({ data: { conversationId } }),
      fetchMsgs({ data: { conversationId } }),
    ]);
    setHeader(h as unknown as Header);
    setMessages(m as unknown as Msg[]);
  }, [conversationId, fetchHeader, fetchMsgs]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Mark conversation read when opened (skip admin read-only view).
  useEffect(() => {
    if (readOnly) return;
    void markRead({ data: { conversationId } }).catch(() => {});
  }, [conversationId, readOnly, markRead, messages.length]);

  useEffect(() => {
    const ch = supabase
      .channel(`conv-${conversationId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => { void refresh(); })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` },
        () => { void refresh(); })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED" || status === "CHANNEL_ERROR" ? status === "SUBSCRIBED" : true);
      });
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, refresh]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    drawerRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isCustomer = !!user && header?.customer_id === user.id;
  const isSeller = !!user && header?.sellers?.user_id === user.id;

  async function handleSend() {
    const t = text.trim();
    if (!t) return;
    setText("");
    try { await sendMsg({ data: { conversationId, content: t } }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not send"); }
  }

  async function handleOffer() {
    const n = Number(offer);
    const pid = header?.product_id ?? header?.products?.id;
    if (!pid) { toast.error("Pick a product to negotiate"); return; }
    if (!Number.isFinite(n) || n <= 0) { toast.error("Enter a valid price"); return; }
    try {
      await sendOfr({ data: { conversationId, productId: pid, newPrice: n } });
      setOffer("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send offer"); }
  }

  async function handleRespond(negId: string, accept: boolean) {
    try { await respond({ data: { negotiationId: negId, accept } }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not respond"); }
  }

  // Direct pay button in chat only for single-store carts with accepted item in this seller
  const acceptedItem = header && items.find(
    (i) => i.sellerId === header.seller_id && i.negotiationId && typeof i.negotiatedPrice === "number",
  );
  const canPayDirect = !multiStore && !readOnly && isCustomer && acceptedItem;
  const negotiatedTotal = items.reduce(
    (s, i) => s + (typeof i.negotiatedPrice === "number" ? i.negotiatedPrice : i.price) * i.quantity, 0,
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-stretch sm:justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={drawerRef}
        tabIndex={-1}
        className="relative flex h-[90vh] sm:h-full w-full sm:w-[440px] flex-col bg-background shadow-2xl rounded-t-2xl sm:rounded-none animate-in slide-in-from-bottom sm:slide-in-from-right"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border p-3">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-muted shrink-0">
            {header?.sellers?.logo_url
              ? <img src={header.sellers.logo_url} alt="" className="h-full w-full object-cover" />
              : <span className="font-serif text-sm">{header?.sellers?.business_name?.[0] ?? "…"}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-sm">{header?.sellers?.business_name ?? "Chat"}</div>
            <div className="text-xs text-muted-foreground truncate">
              {header?.products ? `${header.products.name} · ₦${Number(header.products.price).toLocaleString()}` : "General chat"}
            </div>
          </div>
          <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 capitalize">{header?.status?.replace("_", " ") ?? ""}</span>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted" aria-label="Close chat">
            <X className="h-4 w-4" />
          </button>
        </div>

        {readOnly && (
          <div className="flex items-center gap-2 border-b border-border bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" /> Admin View — Read Only
          </div>
        )}
        {!connected && (
          <div className="border-b border-border bg-muted px-3 py-1.5 text-xs text-center">Reconnecting…</div>
        )}

        {/* Messages */}
        <div ref={scroller} className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/20">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              mine={m.sender_id === user?.id}
              canRespond={isCustomer && !readOnly}
              onRespond={handleRespond}
            />
          ))}
          {messages.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">Say hi 👋</div>
          )}
        </div>

        {/* Direct pay CTA (single-store) */}
        {canPayDirect && (
          <div className="border-t border-border p-3 bg-emerald-50 dark:bg-emerald-950/30">
            <Button
              className="w-full rounded-full h-11"
              onClick={() => { onClose(); window.location.href = "/checkout"; }}
            >
              Pay ₦{negotiatedTotal.toLocaleString()} Now
            </Button>
          </div>
        )}
        {header && !multiStore ? null : (isCustomer && items.some((i) => i.negotiationId) && !readOnly) && (
          <div className="border-t border-border p-3 bg-muted/40">
            <Button variant="outline" className="w-full rounded-full h-11" onClick={() => { onClose(); window.location.href = "/checkout"; }}>
              Go to Checkout
            </Button>
          </div>
        )}

        {/* Composer */}
        {!readOnly && (isCustomer || isSeller) && (
          <div className="border-t border-border p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                placeholder="Type a message…"
                className="h-11"
              />
              <Button onClick={handleSend} className="h-11 w-11 p-0 rounded-full" aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {isSeller && header?.products && (
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="text-xs font-semibold">Send a Price Offer</div>
                <div className="text-[11px] text-muted-foreground">
                  {header.products.name} · Original: ₦{Number(header.products.price).toLocaleString()}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={offer}
                    onChange={(e) => setOffer(e.target.value)}
                    placeholder="New price (NGN)"
                    className="h-10"
                  />
                  <Button onClick={handleOffer} className="h-10 rounded-full">Send Offer</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  m, mine, canRespond, onRespond,
}: {
  m: Msg; mine: boolean; canRespond: boolean;
  onRespond: (negId: string, accept: boolean) => void;
}) {
  if (m.message_type === "system") {
    return (
      <div className="text-center text-[11px] text-muted-foreground py-1">{m.content}</div>
    );
  }
  if (m.message_type === "offer") {
    const status = m.offer_status ?? "pending";
    const declined = status === "declined";
    return (
      <div className={`max-w-[85%] rounded-2xl border p-3 text-sm ${mine ? "ml-auto bg-primary/5 border-primary/30" : "bg-card border-border"} ${declined ? "opacity-60" : ""}`}>
        <div className="text-xs font-semibold flex items-center gap-1.5">💰 Price Offer {declined && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">Declined</span>}{status === "accepted" && <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px]">Accepted</span>}</div>
        <div className="mt-1 text-[13px]">{m.content}</div>
        <div className="mt-2 text-xs">
          New offer: <span className="font-bold">₦{Number(m.offer_amount ?? 0).toLocaleString()}</span>
        </div>
        {status === "pending" && canRespond && m.negotiation_id && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => onRespond(m.negotiation_id!, true)} className="rounded-full h-8">Accept</Button>
            <Button size="sm" variant="outline" onClick={() => onRespond(m.negotiation_id!, false)} className="rounded-full h-8">Decline</Button>
          </div>
        )}
        {status === "pending" && !canRespond && (
          <div className="mt-2 text-[11px] text-muted-foreground">Offer sent — awaiting response</div>
        )}
      </div>
    );
  }
  return (
    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "ml-auto bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
      <div className="whitespace-pre-wrap break-words">{m.content}</div>
      <div className={`mt-0.5 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

/** Utility button that opens a chat given seller/product. */
export function NegotiateButton({
  sellerId, productId, className = "", label = "Negotiate Price 💬",
}: {
  sellerId: string; productId?: string; className?: string; label?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const openConv = useServerFn(openConversation);

  async function handleClick() {
    if (!user) {
      toast("Sign in to negotiate prices with store owners", {
        action: { label: "Sign in", onClick: () => { window.location.href = "/login"; } },
      });
      return;
    }
    setLoading(true);
    try {
      const res = await openConv({ data: { sellerId, productId } });
      setOpen(res.conversationId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open chat");
    } finally { setLoading(false); }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={loading}
        className={`rounded-full ${className}`}
      >
        {label}
      </Button>
      {open && <ChatDrawer conversationId={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export { Flag };
