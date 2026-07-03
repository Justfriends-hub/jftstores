
-- Conversation status enum
DO $$ BEGIN
  CREATE TYPE public.conversation_status AS ENUM ('active','negotiating','price_agreed','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_type AS ENUM ('text','offer','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.offer_status AS ENUM ('pending','accepted','declined','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  store_slug text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  status public.conversation_status NOT NULL DEFAULT 'active',
  flagged boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, seller_id)
);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations select own" ON public.conversations FOR SELECT TO authenticated
USING (
  customer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
  OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "conversations insert customer" ON public.conversations FOR INSERT TO authenticated
WITH CHECK (customer_id = auth.uid());
CREATE POLICY "conversations update participants" ON public.conversations FOR UPDATE TO authenticated
USING (
  customer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
  OR public.has_role(auth.uid(),'admin')
);

CREATE INDEX IF NOT EXISTS conversations_customer_idx ON public.conversations(customer_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_seller_idx ON public.conversations(seller_id, last_message_at DESC);

-- MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('customer','seller','admin','system')),
  message_type public.message_type NOT NULL DEFAULT 'text',
  content text NOT NULL DEFAULT '',
  offer_amount numeric(12,2),
  offer_status public.offer_status,
  negotiation_id uuid,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages select participants" ON public.messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.customer_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = c.seller_id AND s.user_id = auth.uid())
           OR public.has_role(auth.uid(),'admin'))
  )
);
CREATE POLICY "messages insert participants" ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.customer_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = c.seller_id AND s.user_id = auth.uid()))
  )
);
CREATE POLICY "messages update read" ON public.messages FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.customer_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = c.seller_id AND s.user_id = auth.uid()))
  )
);

CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages(conversation_id, created_at);

-- NEGOTIATED_PRICES
CREATE TABLE IF NOT EXISTS public.negotiated_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  original_price numeric(12,2) NOT NULL,
  negotiated_price numeric(12,2) NOT NULL,
  status public.offer_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT neg_price_valid CHECK (negotiated_price > 0 AND negotiated_price <= original_price)
);
GRANT SELECT, INSERT, UPDATE ON public.negotiated_prices TO authenticated;
GRANT ALL ON public.negotiated_prices TO service_role;
ALTER TABLE public.negotiated_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "neg select participants" ON public.negotiated_prices FOR SELECT TO authenticated
USING (
  customer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
  OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "neg insert seller" ON public.negotiated_prices FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
);
CREATE POLICY "neg update participants" ON public.negotiated_prices FOR UPDATE TO authenticated
USING (
  customer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS neg_customer_idx ON public.negotiated_prices(customer_id, status);

-- CART_ITEMS additions
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS negotiated_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS negotiation_id uuid REFERENCES public.negotiated_prices(id) ON DELETE SET NULL;

-- ORDER_ITEMS additions
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS original_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS negotiated_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS price_reduction numeric(12,2),
  ADD COLUMN IF NOT EXISTS negotiation_id uuid REFERENCES public.negotiated_prices(id) ON DELETE SET NULL;

-- Triggers: update conversation last_message_at
CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.conversations
     SET last_message_at = now(), updated_at = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_conv ON public.messages;
CREATE TRIGGER trg_touch_conv AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_on_message();

-- Notify participants on new message
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_customer uuid; v_seller_user uuid; v_store text;
BEGIN
  IF NEW.sender_role = 'system' THEN RETURN NEW; END IF;
  SELECT c.customer_id, s.user_id, s.business_name
    INTO v_customer, v_seller_user, v_store
  FROM public.conversations c
  JOIN public.sellers s ON s.id = c.seller_id
  WHERE c.id = NEW.conversation_id;

  IF NEW.sender_role = 'seller' AND v_customer IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, url, type)
    VALUES (v_customer,
      CASE WHEN NEW.message_type='offer' THEN '💰 Price offer from '||v_store ELSE 'New message from '||v_store END,
      COALESCE(NULLIF(NEW.content,''), CASE WHEN NEW.message_type='offer' THEN '₦'||NEW.offer_amount::text ELSE '' END),
      '/messages?c='||NEW.conversation_id::text, 'chat');
  ELSIF NEW.sender_role = 'customer' AND v_seller_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, url, type)
    VALUES (v_seller_user, 'New message from a customer',
      LEFT(COALESCE(NEW.content,''),120), '/dashboard?tab=messages&c='||NEW.conversation_id::text, 'chat');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_msg ON public.messages;
CREATE TRIGGER trg_notify_msg AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_conv_updated ON public.conversations;
CREATE TRIGGER trg_conv_updated BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_neg_updated ON public.negotiated_prices;
CREATE TRIGGER trg_neg_updated BEFORE UPDATE ON public.negotiated_prices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.negotiated_prices;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
