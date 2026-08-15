GRANT SELECT (id, user_id, business_name, slug, description, logo_url, banner_url, theme_id, status, category, is_featured, created_at, updated_at, rank) ON public.sellers TO anon;
GRANT SELECT ON public.sellers TO authenticated;
GRANT ALL ON public.sellers TO service_role;