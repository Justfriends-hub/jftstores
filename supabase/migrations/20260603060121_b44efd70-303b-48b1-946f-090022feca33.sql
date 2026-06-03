
-- page_visits
CREATE TABLE public.page_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  user_id uuid,
  ip_address text,
  country text,
  country_code text,
  region text,
  city text,
  latitude numeric,
  longitude numeric,
  page_url text NOT NULL,
  store_slug text,
  referrer text,
  user_agent text,
  visited_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.page_visits TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.page_visits TO authenticated;
GRANT ALL ON public.page_visits TO service_role;
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log a page visit" ON public.page_visits FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins view page visits" ON public.page_visits FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_page_visits_visited_at ON public.page_visits(visited_at DESC);
CREATE INDEX idx_page_visits_store_slug ON public.page_visits(store_slug);
CREATE INDEX idx_page_visits_user_id ON public.page_visits(user_id);
CREATE INDEX idx_page_visits_country ON public.page_visits(country);

-- user_journeys
CREATE TABLE public.user_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  user_id uuid,
  from_store_slug text,
  from_page text,
  to_store_slug text,
  to_page text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.user_journeys TO anon, authenticated;
GRANT SELECT ON public.user_journeys TO authenticated;
GRANT ALL ON public.user_journeys TO service_role;
ALTER TABLE public.user_journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log a journey" ON public.user_journeys FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins view journeys" ON public.user_journeys FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_user_journeys_created_at ON public.user_journeys(created_at DESC);
CREATE INDEX idx_user_journeys_from_store ON public.user_journeys(from_store_slug);

-- ip_blocks
CREATE TABLE public.ip_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL UNIQUE,
  reason text,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ip_blocks TO authenticated;
GRANT ALL ON public.ip_blocks TO service_role;
ALTER TABLE public.ip_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ip blocks" ON public.ip_blocks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- admin_logs
CREATE TABLE public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view logs" ON public.admin_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert logs" ON public.admin_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());
CREATE INDEX idx_admin_logs_created_at ON public.admin_logs(created_at DESC);

-- sellers additions
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS rank integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_orders integer NOT NULL DEFAULT 0;

-- profiles additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_store_slug text,
  ADD COLUMN IF NOT EXISTS ip_country text,
  ADD COLUMN IF NOT EXISTS ip_region text,
  ADD COLUMN IF NOT EXISTS ip_city text,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Allow admins to manage profiles (block, etc.)
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
