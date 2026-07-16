// Server functions for chat + price negotiation.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// Sanitize: strip control chars, cap length. React escapes on render.
function clean(s: string, max = 2000) {
  return s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim().slice(0, max);
}

export const openConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sellerId: uuid, productId: uuid.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: seller, error: sErr } = await sb
      .from("sellers")
      .select("id, slug, user_id, business_name")
      .eq("id", data.sellerId)
      .maybeSingle();
    if (sErr || !seller) throw new Error("Store not found");
    if (seller.user_id === context.userId) throw new Error("You cannot chat with your own store");

    const { data: existing } = await sb
      .from("conversations")
      .select("id")
      .eq("customer_id", context.userId)
      .eq("seller_id", data.sellerId)
      .maybeSingle();
    if (existing) {
      if (data.productId) {
        await sb.from("conversations").update({ product_id: data.productId }).eq("id", existing.id);
      }
      return { conversationId: existing.id };
    }
    const { data: created, error: cErr } = await sb
      .from("conversations")
      .insert({
        customer_id: context.userId,
        seller_id: data.sellerId,
        store_slug: seller.slug,
        product_id: data.productId ?? null,
        status: "active",
      })
      .select("id")
      .single();
    if (cErr || !created) throw new Error(cErr?.message ?? "Could not open chat");
    return { conversationId: created.id };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ conversationId: uuid, content: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: conv } = await sb
      .from("conversations")
      .select("id, customer_id, seller_id, sellers(user_id)")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) throw new Error("Chat not found");
    const isCustomer = conv.customer_id === context.userId;
    const sellerUser = (conv.sellers as unknown as { user_id: string } | null)?.user_id;
    const isSeller = sellerUser === context.userId;
    if (!isCustomer && !isSeller) throw new Error("Forbidden");

    const { error } = await sb.from("messages").insert({
      conversation_id: data.conversationId,
      sender_id: context.userId,
      sender_role: isCustomer ? "customer" : "seller",
      message_type: "text",
      content: clean(data.content),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      conversationId: uuid,
      productId: uuid,
      newPrice: z.number().positive(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: conv } = await sb
      .from("conversations")
      .select("id, customer_id, seller_id, sellers(user_id)")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) throw new Error("Chat not found");
    const sellerUser = (conv.sellers as unknown as { user_id: string } | null)?.user_id;
    if (sellerUser !== context.userId) throw new Error("Only the store owner can send offers");

    const { data: product } = await sb
      .from("products")
      .select("id, price, name, seller_id")
      .eq("id", data.productId)
      .maybeSingle();
    if (!product || product.seller_id !== conv.seller_id) throw new Error("Product not found");
    const original = Number(product.price);
    if (data.newPrice <= 0 || data.newPrice > original) {
      throw new Error("Offer must be greater than 0 and less than the original price");
    }

    const { data: neg, error: negErr } = await sb
      .from("negotiated_prices")
      .insert({
        conversation_id: data.conversationId,
        product_id: data.productId,
        customer_id: conv.customer_id,
        seller_id: conv.seller_id,
        original_price: original,
        negotiated_price: data.newPrice,
        status: "pending",
      })
      .select("id")
      .single();
    if (negErr || !neg) throw new Error(negErr?.message ?? "Could not create offer");

    await sb.from("messages").insert({
      conversation_id: data.conversationId,
      sender_id: context.userId,
      sender_role: "seller",
      message_type: "offer",
      content: product.name,
      offer_amount: data.newPrice,
      offer_status: "pending",
      negotiation_id: neg.id,
      product_id: data.productId,
    });
    await sb.from("conversations").update({ status: "negotiating" }).eq("id", data.conversationId);
    return { ok: true, negotiationId: neg.id };
  });

export const respondToOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      negotiationId: uuid,
      accept: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: neg } = await sb
      .from("negotiated_prices")
      .select("id, conversation_id, customer_id, product_id, negotiated_price, status, expires_at")
      .eq("id", data.negotiationId)
      .maybeSingle();
    if (!neg) throw new Error("Offer not found");
    if (neg.customer_id !== context.userId) throw new Error("Only the customer can respond");
    if (neg.status !== "pending") throw new Error("This offer is no longer pending");
    if (new Date(neg.expires_at).getTime() < Date.now()) {
      await sb.from("negotiated_prices").update({ status: "expired" }).eq("id", neg.id);
      throw new Error("Offer expired");
    }

    const newStatus = data.accept ? "accepted" : "declined";
    await sb.from("negotiated_prices").update({ status: newStatus }).eq("id", neg.id);
    await sb
      .from("messages")
      .update({ offer_status: newStatus })
      .eq("negotiation_id", neg.id)
      .eq("message_type", "offer");

    await sb.from("messages").insert({
      conversation_id: neg.conversation_id,
      sender_id: context.userId,
      sender_role: "system",
      message_type: "system",
      content: data.accept
        ? `🎉 Price agreed! ₦${Number(neg.negotiated_price).toLocaleString()} applied to your cart.`
        : "Offer declined. You can keep chatting.",
    });

    if (data.accept) {
      await sb
        .from("conversations")
        .update({ status: "price_agreed" })
        .eq("id", neg.conversation_id);
    }
    return { ok: true };
  });

// Fetch active accepted (non-expired) negotiations for current customer.
export const listMyActiveNegotiations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data } = await sb
      .from("negotiated_prices")
      .select("id, product_id, seller_id, negotiated_price, original_price, status, expires_at")
      .eq("customer_id", context.userId)
      .eq("status", "accepted");
    const now = Date.now();
    return (data ?? []).filter((n) => new Date(n.expires_at).getTime() > now);
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: msgs } = await sb
      .from("messages")
      .select("id, sender_id, sender_role, message_type, content, offer_amount, offer_status, negotiation_id, product_id, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    return msgs ?? [];
  });

export const getConversationHeader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: conv } = await sb
      .from("conversations")
      .select("id, customer_id, seller_id, product_id, status, store_slug, sellers(id, business_name, logo_url, user_id), products(id, name, price, images)")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) throw new Error("Chat not found");
    return conv;
  });

export const listMyConversationsForCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data } = await sb
      .from("conversations")
      .select("id, seller_id, status, last_message_at, sellers(business_name, logo_url, slug)")
      .eq("customer_id", context.userId)
      .order("last_message_at", { ascending: false });
    return data ?? [];
  });

export const listSellerConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: seller } = await sb
      .from("sellers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!seller) return [];
    const { data } = await sb
      .from("conversations")
      .select("id, customer_id, status, last_message_at, product_id, products(name), profiles!conversations_customer_id_fkey(full_name, email)")
      .eq("seller_id", seller.id)
      .order("last_message_at", { ascending: false });
    return data ?? [];
  });

// Admin: read all conversations
export const adminListConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("conversations")
      .select("id, status, flagged, last_message_at, customer_id, seller_id, sellers(business_name, slug), profiles!conversations_customer_id_fkey(full_name, email)")
      .order("last_message_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const adminGetConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id, status, flagged, customer_id, seller_id, sellers(business_name, slug, logo_url), profiles!conversations_customer_id_fkey(full_name, email)")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) throw new Error("Not found");
    const { data: msgs } = await supabaseAdmin
      .from("messages")
      .select("id, sender_role, message_type, content, offer_amount, offer_status, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    return { conv, messages: msgs ?? [] };
  });

export const adminFlagConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ conversationId: uuid, flagged: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("conversations")
      .update({ flagged: data.flagged })
      .eq("id", data.conversationId);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: data.flagged ? "flag_conversation" : "unflag_conversation",
      target_type: "conversation",
      target_id: data.conversationId,
    });
    return { ok: true };
  });

// ---- Unread message counts ----

// Returns unread counts for the current user (as customer + seller) plus
// per-conversation map. RLS scopes messages to conversations the user is in.
export const getUnreadCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: seller } = await sb
      .from("sellers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    // All unread messages I can see that I did not send.
    const { data: rows } = await sb
      .from("messages")
      .select("conversation_id, sender_id, sender_role, conversations!inner(customer_id, seller_id)")
      .eq("is_read", false)
      .neq("sender_role", "system");

    let customerTotal = 0;
    let sellerTotal = 0;
    const byConversation: Record<string, number> = {};
    for (const r of (rows ?? []) as Array<{
      conversation_id: string;
      sender_id: string | null;
      sender_role: string;
      conversations: { customer_id: string; seller_id: string } | null;
    }>) {
      if (r.sender_id === context.userId) continue;
      const conv = r.conversations;
      if (!conv) continue;
      const iAmCustomer = conv.customer_id === context.userId;
      const iAmSeller = !!seller && conv.seller_id === seller.id;
      if (!iAmCustomer && !iAmSeller) continue;
      byConversation[r.conversation_id] = (byConversation[r.conversation_id] ?? 0) + 1;
      if (iAmCustomer && r.sender_role === "seller") customerTotal++;
      if (iAmSeller && r.sender_role === "customer") sellerTotal++;
    }
    return { customerTotal, sellerTotal, total: customerTotal + sellerTotal, byConversation };
  });

// Mark all messages in a conversation as read (except the ones I sent).
export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { error } = await sb
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", data.conversationId)
      .eq("is_read", false)
      .neq("sender_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Set a conversation's status. Participants (customer or seller) only.
// Allowed transitions: active | negotiating | price_agreed | resolved | closed.
export const setConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      conversationId: uuid,
      status: z.enum(["active", "resolved", "closed"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: conv } = await sb
      .from("conversations")
      .select("id, customer_id, seller_id, status, sellers(user_id)")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) throw new Error("Chat not found");
    const isCustomer = conv.customer_id === context.userId;
    const sellerUser = (conv.sellers as unknown as { user_id: string } | null)?.user_id;
    const isSeller = sellerUser === context.userId;
    if (!isCustomer && !isSeller) throw new Error("Forbidden");

    const { error } = await sb
      .from("conversations")
      .update({ status: data.status })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);

    const label =
      data.status === "resolved" ? "marked this conversation as resolved" :
      data.status === "closed" ? "closed this conversation" :
      "reopened this conversation";
    await sb.from("messages").insert({
      conversation_id: data.conversationId,
      sender_id: context.userId,
      sender_role: "system",
      message_type: "system",
      content: `${isCustomer ? "Customer" : "Seller"} ${label}.`,
    });
    return { ok: true };
  });


// Admin: attention counts (flagged + unread admin view heuristic).
export const adminGetAttentionCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count: flagged } = await supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("flagged", true);
    return { flagged: flagged ?? 0 };
  });

