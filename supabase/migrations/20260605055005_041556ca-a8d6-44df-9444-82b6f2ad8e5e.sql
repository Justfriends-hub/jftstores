-- Profiles: prevent users from changing email/is_blocked/IP fields via column-level grants
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, whatsapp_number) ON public.profiles TO authenticated;

-- Sellers: prevent self-approval and metric tampering via column-level grants
REVOKE UPDATE ON public.sellers FROM authenticated;
GRANT UPDATE (business_name, slug, description, logo_url, banner_url, theme_id, whatsapp_number, category) ON public.sellers TO authenticated;

-- Order items: sellers may only toggle fulfillment
REVOKE UPDATE ON public.order_items FROM authenticated;
GRANT UPDATE (fulfilled) ON public.order_items TO authenticated;

-- Push subscriptions: require authentication to register
REVOKE INSERT ON public.push_subscriptions FROM anon;
DROP POLICY IF EXISTS "Anyone can register a push sub" ON public.push_subscriptions;
CREATE POLICY "Authenticated users register own push sub"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Realtime: restrict notification channel topic subscriptions to the owning user
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users subscribe to own notification topic" ON realtime.messages;
CREATE POLICY "Users subscribe to own notification topic"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    topic LIKE 'realtime:%'
    OR topic = 'notifications-' || auth.uid()::text
  );