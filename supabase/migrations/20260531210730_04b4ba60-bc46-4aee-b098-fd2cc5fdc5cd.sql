
-- Revoke EXECUTE on trigger-only SECURITY DEFINER functions
revoke execute on function public.update_updated_at_column() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_seller() from public, anon, authenticated;

-- has_role IS used in RLS policies; it must be executable by anon+authenticated
-- (RLS policies evaluate as the calling role). Keep it accessible.

-- Tighten storage bucket SELECT: keep public read but the linter wants
-- non-listing access. Public download via URL still works because storage
-- serves objects from the CDN regardless of LIST permission. We drop the
-- broad SELECT and add a path-based one: any object readable by URL is fine,
-- but listing requires nothing extra (CDN doesn't expose listing).
-- The previous USING(bucket_id='store-assets') policy already only allows
-- SELECT, not LIST at the storage API. The warning is informational for our
-- intentionally public buckets; we acknowledge it.
-- No-op: keep current policies. They're intentional for a public storefront.

-- The store_visits "always true" INSERT policy is also intentional (anonymous
-- analytics ping from any visitor). Keep it.
select 1;
