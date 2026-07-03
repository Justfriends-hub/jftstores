// Client hook: keeps client cart in sync with server-side negotiated_prices.
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { listMyActiveNegotiations } from "@/lib/chat.functions";

export function NegotiationsSync() {
  const { user } = useAuth();
  const { items, syncNegotiations } = useCart();
  const fetchNegs = useServerFn(listMyActiveNegotiations);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function refresh() {
      try {
        const negs = await fetchNegs();
        if (cancelled) return;
        const map = new Map<string, { price: number; id: string }>();
        for (const n of negs) {
          map.set(n.product_id, { price: Number(n.negotiated_price), id: n.id });
        }
        // Detect expiries locally too
        for (const it of items) {
          if (it.negotiationId && !map.has(it.productId)) {
            toast(`Negotiated price for ${it.productName} is no longer active. Original price restored.`);
          }
        }
        syncNegotiations(map);
      } catch { /* noop */ }
    }

    void refresh();

    const ch = supabase
      .channel(`neg-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "negotiated_prices", filter: `customer_id=eq.${user.id}` },
        () => { void refresh(); },
      )
      .subscribe();

    const interval = setInterval(refresh, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return null;
}
