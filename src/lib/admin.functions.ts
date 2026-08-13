// Admin-only server functions. Gated by admin role check + service-role client.
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

async function log(adminId: string, action: string, targetType: string | null, targetId: string | null, meta: Record<string, unknown> = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("admin_logs").insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    meta: meta as never,
  });
}

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await log(context.userId, "delete_user", "user", data.userId);
    return { ok: true };
  });

export const setUserBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; blocked: boolean }) =>
    z.object({ userId: z.string().uuid(), blocked: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_blocked: data.blocked })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    if (data.blocked) {
      // Sign out all sessions for this user
      await supabaseAdmin.auth.admin.signOut(data.userId).catch(() => {});
    }
    await log(context.userId, data.blocked ? "block_user" : "unblock_user", "user", data.userId);
    return { ok: true };
  });

export const promoteToSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: "seller" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    await log(context.userId, "promote_seller", "user", data.userId);
    return { ok: true };
  });

export const setSellerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sellerId: string; status: "pending" | "approved" | "suspended" }) =>
    z
      .object({
        sellerId: z.string().uuid(),
        status: z.enum(["pending", "approved", "suspended"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sellers")
      .update({ status: data.status })
      .eq("id", data.sellerId);
    if (error) throw new Error(error.message);
    await log(context.userId, `seller_${data.status}`, "seller", data.sellerId);
    // Approve/suspend changes which storefronts are public: refresh the sitemap now.
    const { revalidateSitemap } = await import("@/lib/sitemap-revalidate.server");
    await revalidateSitemap("https://jftstores.lovable.app").catch(() => {});
    return { ok: true };
  });


export const updateSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sellerId: string; patch: { rank?: number; is_featured?: boolean } }) =>
    z
      .object({
        sellerId: z.string().uuid(),
        patch: z.object({
          rank: z.number().int().min(0).max(9999).optional(),
          is_featured: z.boolean().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sellers")
      .update(data.patch)
      .eq("id", data.sellerId);
    if (error) throw new Error(error.message);
    await log(context.userId, "update_seller", "seller", data.sellerId, data.patch);
    return { ok: true };
  });
