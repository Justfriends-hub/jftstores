
CREATE OR REPLACE FUNCTION public.notify_visitors_on_new_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slug text;
  v_name text;
BEGIN
  IF NEW.is_active = false THEN RETURN NEW; END IF;
  SELECT slug, business_name INTO v_slug, v_name FROM public.sellers WHERE id = NEW.seller_id;
  IF v_slug IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, body, url, type)
  SELECT DISTINCT pv.user_id,
         'New from ' || v_name,
         NEW.name,
         '/store/' || v_slug,
         'product'
  FROM public.page_visits pv
  WHERE pv.store_slug = v_slug
    AND pv.user_id IS NOT NULL
    AND pv.user_id <> (SELECT user_id FROM public.sellers WHERE id = NEW.seller_id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_new_product
AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_visitors_on_new_product();

CREATE OR REPLACE FUNCTION public.notify_seller_on_order_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_seller_user uuid;
BEGIN
  SELECT user_id INTO v_seller_user FROM public.sellers WHERE id = NEW.seller_id;
  IF v_seller_user IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, body, url, type)
  VALUES (v_seller_user, 'New order received', NEW.product_name || ' × ' || NEW.quantity, '/dashboard', 'order');
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_seller_order
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.notify_seller_on_order_item();
