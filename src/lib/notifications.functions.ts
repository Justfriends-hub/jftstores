// Notification + broadcast server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admins only");
}

const broadcastSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(800),
  url: z.string().trim().max(500).optional().or(z.literal("")),
  target: z.enum(["everyone", "customers", "sellers", "store"]),
  targetSellerId: z.string().uuid().optional().nullable(),
});

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => broadcastSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve recipient user_ids
    let userIds: string[] = [];

    if (data.target === "everyone") {
      const { data: rows } = await supabaseAdmin.from("profiles").select("id");
      userIds = (rows ?? []).map((r) => r.id);
    } else if (data.target === "customers") {
      const { data: rows } = await supabaseAdmin
        .from("user_roles").select("user_id").eq("role", "customer");
      userIds = (rows ?? []).map((r) => r.user_id);
    } else if (data.target === "sellers") {
      const { data: rows } = await supabaseAdmin
        .from("user_roles").select("user_id").eq("role", "seller");
      userIds = (rows ?? []).map((r) => r.user_id);
    } else if (data.target === "store") {
      if (!data.targetSellerId) throw new Error("targetSellerId required");
      // Customers who have visited this store
      const { data: seller } = await supabaseAdmin
        .from("sellers").select("slug").eq("id", data.targetSellerId).maybeSingle();
      if (!seller) throw new Error("Store not found");
      const { data: visits } = await supabaseAdmin
        .from("page_visits")
        .select("user_id")
        .eq("store_slug", seller.slug)
        .not("user_id", "is", null);
      userIds = Array.from(new Set((visits ?? []).map((v) => v.user_id as string)));
    }

    userIds = Array.from(new Set(userIds)).filter(Boolean);
    if (userIds.length === 0) {
      const { data: br } = await supabaseAdmin.from("broadcasts").insert({
        admin_id: context.userId,
        title: data.title,
        body: data.body,
        url: data.url || null,
        target: data.target,
        target_seller_id: data.targetSellerId ?? null,
        recipients_count: 0,
      }).select("id").single();
      return { ok: true, recipients: 0, broadcastId: br?.id };
    }

    // Bulk insert notifications in chunks of 500
    const rows = userIds.map((uid) => ({
      user_id: uid,
      title: data.title,
      body: data.body,
      url: data.url || null,
      type: "broadcast",
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabaseAdmin.from("notifications").insert(chunk);
      if (error) throw new Error(error.message);
    }

    // Log broadcast
    const { data: br } = await supabaseAdmin.from("broadcasts").insert({
      admin_id: context.userId,
      title: data.title,
      body: data.body,
      url: data.url || null,
      target: data.target,
      target_seller_id: data.targetSellerId ?? null,
      recipients_count: userIds.length,
    }).select("id").single();

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "broadcast_sent",
      target_type: "broadcast",
      target_id: br?.id ?? null,
      meta: { target: data.target, recipients: userIds.length } as never,
    });

    // Web Push delivery: requires VAPID keys. If configured, attempt delivery.
    // Push delivery in Workers requires a Worker-compatible VAPID lib.
    // In-app notifications work immediately via realtime; push is best-effort.
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      try {
        const { sendPushToUsers } = await import("./push.server");
        await sendPushToUsers(userIds, {
          title: data.title,
          body: data.body,
          url: data.url || "/",
        });
      } catch (e) {
        console.error("push send failed", e);
      }
    }

    return { ok: true, recipients: userIds.length, broadcastId: br?.id };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", context.userId)
      .eq("is_read", false);
    return { ok: true };
  });
