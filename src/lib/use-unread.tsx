import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getUnreadCounts } from "@/lib/chat.functions";

export type UnreadState = {
  customerTotal: number;
  sellerTotal: number;
  total: number;
  byConversation: Record<string, number>;
  refresh: () => Promise<void>;
};

/**
 * Live-updating unread message counts for the signed-in user.
 * Subscribes to public.messages INSERT/UPDATE to refresh on the fly.
 */
export function useUnreadMessages(): UnreadState {
  const { user } = useAuth();
  const load = useServerFn(getUnreadCounts);
  const [state, setState] = useState<Omit<UnreadState, "refresh">>({
    customerTotal: 0, sellerTotal: 0, total: 0, byConversation: {},
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setState({ customerTotal: 0, sellerTotal: 0, total: 0, byConversation: {} });
      return;
    }
    try {
      const d = await load();
      setState({
        customerTotal: d.customerTotal,
        sellerTotal: d.sellerTotal,
        total: d.total,
        byConversation: d.byConversation ?? {},
      });
    } catch { /* ignore */ }
  }, [user, load]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    // Unique topic per mount: reusing a topic can hand back an already-subscribed
    // channel, and calling .on() on it throws and blanks the page.
    const topic = `unread-${user.id}-${Math.random().toString(36).slice(2)}`;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(topic)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => { void refresh(); })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => { void refresh(); })
        .subscribe();
    } catch (e) {
      console.warn("unread realtime unavailable", e);
    }
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [user, refresh]);


  return { ...state, refresh };
}
