// Server functions for Paystack-backed checkout.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  sellerId: z.string().uuid(),
  productName: z.string().min(1).max(200),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive().max(999),
  negotiationId: z.string().uuid().nullable().optional(),
});

const verifySchema = z.object({
  reference: z.string().min(6).max(200),
  customerName: z.string().trim().min(1).max(120),
  customerEmail: z.string().trim().email().max(200),
  customerPhone: z.string().trim().min(4).max(40),
  items: z.array(cartItemSchema).min(1).max(200),
});

/**
 * Server-side price resolution: for each item, if a valid (accepted + non-expired)
 * negotiation exists for this customer/product/seller, use negotiated_price. Never
 * trust the client-sent price beyond product lookup.
 */
async function resolveVerifiedItems(
  supabaseAdmin: Awaited<ReturnType<typeof import("@/integrations/supabase/client.server")>>["supabaseAdmin"],
  customerId: string,
  items: z.infer<typeof cartItemSchema>[],
) {
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, price, name, seller_id")
    .in("id", productIds);
  const pmap = new Map((products ?? []).map((p) => [p.id, p]));

  const { data: negs } = await supabaseAdmin
    .from("negotiated_prices")
    .select("id, product_id, seller_id, negotiated_price, original_price, status, expires_at")
    .eq("customer_id", customerId)
    .eq("status", "accepted")
    .in("product_id", productIds);
  const now = Date.now();
  const validNegs = new Map<string, { id: string; price: number }>();
  for (const n of negs ?? []) {
    if (new Date(n.expires_at).getTime() > now) {
      validNegs.set(`${n.product_id}:${n.seller_id}`, {
        id: n.id, price: Number(n.negotiated_price),
      });
    }
  }

  let total = 0;
  const rows = items.map((i) => {
    const p = pmap.get(i.productId);
    if (!p) throw new Error(`Product not found: ${i.productId}`);
    if (p.seller_id !== i.sellerId) throw new Error("Item/seller mismatch");
    const original = Number(p.price);
    const key = `${i.productId}:${i.sellerId}`;
    const neg = validNegs.get(key);
    const effective = neg ? neg.price : original;
    total += effective * i.quantity;
    return {
      product_id: i.productId,
      seller_id: i.sellerId,
      product_name: p.name,
      quantity: i.quantity,
      price_at_purchase: effective,
      original_price: original,
      negotiated_price: neg ? neg.price : null,
      price_reduction: neg ? original - neg.price : null,
      negotiation_id: neg?.id ?? null,
    };
  });
  return { total, rows };
}

/**
 * Public helper for client: get the server-verified total in NGN
 * for the cart before initializing Paystack.
 */
export const computeVerifiedTotal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ items: z.array(cartItemSchema).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { total } = await resolveVerifiedItems(supabaseAdmin, context.userId, data.items);
    return { total };
  });

export const verifyPaystackAndCreateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => verifySchema.parse(d))
  .handler(async ({ data, context }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payment provider not configured");

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    if (!res.ok) throw new Error(`Payment verification failed (${res.status})`);
    const body = (await res.json()) as {
      status: boolean;
      data?: { status: string; amount: number; currency: string; reference: string };
    };
    if (!body.status || !body.data || body.data.status !== "success") {
      throw new Error("Payment was not successful");
    }
    if (body.data.currency && body.data.currency.toUpperCase() !== "NGN") {
      throw new Error("Unexpected currency");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { total: expectedTotal, rows } = await resolveVerifiedItems(
      supabaseAdmin, context.userId, data.items,
    );
    const expectedKobo = Math.round(expectedTotal * 100);
    if (body.data.amount < expectedKobo) {
      throw new Error("Paid amount does not match verified cart total");
    }

    // Idempotency
    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("payment_reference", data.reference)
      .maybeSingle();
    if (existing) return { ok: true, orderId: existing.id, duplicate: true };

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: context.userId,
        customer_email: data.customerEmail,
        customer_name: data.customerName,
        total_amount: expectedTotal,
        status: "paid",
        currency: "NGN",
        payment_provider: "paystack",
        payment_reference: data.reference,
      })
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Failed to create order");

    const itemsRows = rows.map((r) => ({ order_id: order.id, ...r }));
    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsRows);
    if (itemsErr) throw new Error(itemsErr.message);

    // Notify sellers with contact info
    const sellerIds = Array.from(new Set(rows.map((r) => r.seller_id)));
    const { data: sellers } = await supabaseAdmin
      .from("sellers")
      .select("id, user_id, business_name")
      .in("id", sellerIds);
    if (sellers && sellers.length) {
      const notifs = sellers.map((s) => ({
        user_id: s.user_id,
        title: "New paid order",
        body: `${data.customerName} (${data.customerPhone}) just paid for items from ${s.business_name}.`,
        url: "/dashboard",
        type: "order",
      }));
      await supabaseAdmin.from("notifications").insert(notifs);
    }

    return { ok: true, orderId: order.id, duplicate: false };
  });

export const getOrderSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string }) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, customer_id, customer_name, customer_email, total_amount, currency, status, payment_reference, created_at")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");
    if (order.customer_id !== context.userId) throw new Error("Forbidden");
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("id, product_name, quantity, price_at_purchase, seller_id, original_price, negotiated_price, price_reduction")
      .eq("order_id", order.id);
    return { order, items: items ?? [] };
  });
