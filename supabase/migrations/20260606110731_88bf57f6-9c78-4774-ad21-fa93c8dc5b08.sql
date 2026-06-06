
CREATE OR REPLACE FUNCTION public.sellers_guard_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role / server-side calls (no auth.uid()) bypass the guard.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
     OR NEW.rank IS DISTINCT FROM OLD.rank
     OR NEW.total_revenue IS DISTINCT FROM OLD.total_revenue
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify protected seller fields';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.profiles_guard_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.ip_city IS DISTINCT FROM OLD.ip_city
     OR NEW.ip_region IS DISTINCT FROM OLD.ip_region
     OR NEW.ip_country IS DISTINCT FROM OLD.ip_country THEN
    RAISE EXCEPTION 'Cannot modify protected profile fields';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.order_items_guard_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
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
END $function$;
