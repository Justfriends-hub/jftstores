
-- 1. PROFILES: restrict public read; block self-unblock
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE OR REPLACE FUNCTION public.profiles_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.ip_city IS DISTINCT FROM OLD.ip_city
     OR NEW.ip_region IS DISTINCT FROM OLD.ip_region
     OR NEW.ip_country IS DISTINCT FROM OLD.ip_country THEN
    RAISE EXCEPTION 'Cannot modify protected profile fields';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_guard_update ON public.profiles;
CREATE TRIGGER profiles_guard_update BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_update();
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. SELLERS: block self-promotion to approved/featured/rank/revenue
DROP POLICY IF EXISTS "Sellers can update their own profile" ON public.sellers;
CREATE OR REPLACE FUNCTION public.sellers_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
     OR NEW.rank IS DISTINCT FROM OLD.rank
     OR NEW.total_revenue IS DISTINCT FROM OLD.total_revenue
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify protected seller fields';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sellers_guard_update ON public.sellers;
CREATE TRIGGER sellers_guard_update BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.sellers_guard_update();
CREATE POLICY "Sellers update own profile" ON public.sellers
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. ORDER ITEMS: restrict seller update to fulfillment only
DROP POLICY IF EXISTS "Sellers update fulfillment on their items" ON public.order_items;
CREATE OR REPLACE FUNCTION public.order_items_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.product_name IS DISTINCT FROM OLD.product_name
     OR NEW.price_at_purchase IS DISTINCT FROM OLD.price_at_purchase
     OR NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    RAISE EXCEPTION 'Sellers may only update fulfillment status';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS order_items_guard_update ON public.order_items;
CREATE TRIGGER order_items_guard_update BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_guard_update();
CREATE POLICY "Sellers toggle fulfillment on their items" ON public.order_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = order_items.seller_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = order_items.seller_id AND s.user_id = auth.uid()));
