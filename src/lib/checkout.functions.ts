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
});

const verifySchema = z.object({
  reference: z.string().min(6).max(200),
  customerName: z.string().trim().min(1).max(120),
  customerEmail: z.string().trim().email().max(200),
  customerPhone: z.string().trim().min(4).max(40),
  items: z.array(cartItemSchema).min(1).max(200),
});

export const verifyPaystackAndCreateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => verifySchema.parse(d))
  .handler(async ({ data, context }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payment provider not configured");

    // 1. Verify with Paystack
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

    const expectedTotal = data.items.reduce((n, i) => n + i.price * i.quantity, 0);
    const expectedKobo = Math.round(expectedTotal * 100);
    if (body.data.amount < expectedKobo) {
      throw new Error("Paid amount does not match cart total");
    }
    if (body.data.currency && body.data.currency.toUpperCase() !== "NGN") {
      throw new Error("Unexpected currency");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotency: if this reference already produced an order, return it.
    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("payment_reference", data.reference)
      .maybeSingle();
    if (existing) return { ok: true, orderId: existing.id, duplicate: true };

    // 2. Create order
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

    // 3. Create order items
    const itemsRows = data.items.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      seller_id: i.sellerId,
      product_name: i.productName,
      price_at_purchase: i.price,
      quantity: i.quantity,
    }));
    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsRows);
    if (itemsErr) throw new Error(itemsErr.message);

    // 4. Notify sellers (triggers in DB already insert per-item notifications; add phone metadata as separate notification with contact info)
    const sellerIds = Array.from(new Set(data.items.map((i) => i.sellerId)));
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
      .select("id, product_name, quantity, price_at_purchase, seller_id")
      .eq("order_id", order.id);
    return { order, items: items ?? [] };
  });
