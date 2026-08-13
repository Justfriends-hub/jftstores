-- 1. Cart items: guest session carts are unused (cart lives client-side); lock to owners only
DROP POLICY IF EXISTS "Cart select" ON public.cart_items;
DROP POLICY IF EXISTS "Cart insert" ON public.cart_items;
DROP POLICY IF EXISTS "Cart update" ON public.cart_items;
DROP POLICY IF EXISTS "Cart delete" ON public.cart_items;

REVOKE ALL ON public.cart_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;

CREATE POLICY "Cart select" ON public.cart_items FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Cart insert" ON public.cart_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND session_id IS NULL);
CREATE POLICY "Cart update" ON public.cart_items FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Cart delete" ON public.cart_items FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 2. Sellers guard: also protect total_orders from client-side writes
CREATE OR REPLACE FUNCTION public.sellers_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
     OR NEW.rank IS DISTINCT FROM OLD.rank
     OR NEW.total_revenue IS DISTINCT FROM OLD.total_revenue
     OR NEW.total_orders IS DISTINCT FROM OLD.total_orders
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify protected seller fields';
  END IF;
  RETURN NEW;
END $function$;

-- 3. Hide seller WhatsApp numbers (and revenue) from unauthenticated visitors
REVOKE SELECT ON public.sellers FROM anon;
GRANT SELECT (id, user_id, business_name, slug, description, logo_url, banner_url,
              theme_id, status, category, is_featured, created_at, updated_at, rank, total_orders)
  ON public.sellers TO anon;

-- 4. Realtime: only allow subscribing to the user's own notification topic
DROP POLICY IF EXISTS "Users subscribe to own notification topic" ON realtime.messages;
CREATE POLICY "Users subscribe to own notification topic" ON realtime.messages
  FOR SELECT TO authenticated
  USING (topic = ('notifications-' || auth.uid()::text));