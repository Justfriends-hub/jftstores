## Admin Panel Upgrade — Build Plan

This is a large multi-day build. I'll ship it in 4 phases so you can review and course-correct between each. Every phase ends with a working, deployable app.

---

### Phase 1 — Foundation: IP tracking, schema, sidebar shell

**Database migration:**
- `page_visits` (session_id, user_id, ip, country, region, city, lat, lng, page_url, store_slug, referrer, visited_at)
- `user_journeys` (session_id, from_store_slug, to, timestamp)
- `ip_blocks` (ip, reason, blocked_at)
- `admin_logs` (admin_id, action, target_type, target_id, meta, timestamp)
- Add to `sellers`: `rank int default 0`, `total_revenue numeric default 0`, `total_orders int default 0` (`is_featured` already exists)
- Add to `profiles`: `is_blocked bool default false`, `referral_store_slug text`, `ip_country`, `ip_region`, `ip_city`, `last_active_at`
- RLS: read/write only for admins (except `page_visits` insert which is public), `service_role` grants
- Trigger: block sign-in via auth hook isn't possible — instead enforce `is_blocked` at app shell level + RLS on key tables

**IP tracking (client-side, non-blocking):**
- Hook `useTrackPageView()` mounted in `__root.tsx`
- On mount: `fetch('https://ipapi.co/json/')` → insert into `page_visits` (fire-and-forget, swallow errors)
- Track referrer + previous store_slug from sessionStorage → write `user_journeys` row when changes
- Update `profiles.last_active_at` + IP fields for logged-in users
- Set `referral_store_slug` on first visit if landing on `/store/:slug`

**Admin shell:**
- New layout `src/routes/admin.route.tsx` (pathless wrapping `/admin/*`) with shadcn Sidebar: Overview, Users, Stores, Orders, Analytics, Settings
- Gate by `isAdmin`; otherwise show "Admins only"
- Mobile collapsible
- Block-user enforcement: `AuthProvider` checks `profiles.is_blocked` → forces signout + shows "Account suspended" page

---

### Phase 2 — Overview + Orders pages

- **Overview**: KPI cards (visits all-time/today, users, stores, orders, revenue, top-selling store, most-visited store today), live activity feed (subscribed via Supabase Realtime to recent signups/orders/visits), country breakdown table + simple world choropleth (react-simple-maps) OR ranked bar chart of top countries (lighter — I'll use ranked bars unless you want the map; map adds ~150KB)
- **Orders**: paginated table, filters (status, date, store), click → order detail drawer with items, customer, fulfillment toggle

---

### Phase 3 — Users management

- Paginated user table with all required columns (joins to orders count, visits count, referral store)
- Search + filters (name/email/country/role/joined/referral store)
- User detail page: profile, location, visit history, journey, all orders, referral store
- Actions with confirm modals: block / unblock / promote to seller / delete (delete via `supabaseAdmin` server fn)
- All actions logged to `admin_logs`

---

### Phase 4 — Stores management + Analytics

- **Stores**: paginated table sortable by visits/sales/newest/products. Search. Detail view with traffic source breakdown (WhatsApp / cross-store / direct from `page_visits.referrer`), visitor list, products with stock + sales, orders, revenue, top product. Actions: approve / suspend / block / feature toggle / set rank / "Enter as Admin" (impersonation view of seller dashboard with red "Admin View" banner — read+edit)
- **Analytics**: Recharts line charts (pageviews/unique over time, filter day/week/month), traffic source pie, geo table, cross-store journey table, store referral leaderboard

---

### Technical details

- Server functions in `src/lib/admin.functions.ts` using `supabaseAdmin` (bypasses RLS, gated by `requireSupabaseAuth` + `has_role` check)
- All admin reads paginated server-side (limit/offset)
- TanStack Query for caching; skeleton loaders via shadcn `Skeleton`
- Recharts already available
- Confirmation modals via shadcn AlertDialog
- Files kept under 300 lines — split tables/detail panels into subcomponents

### Things to flag

1. **Map vs ranked bars** for geo: I'll default to a clean ranked-country bar + table (faster, no extra dep). Tell me if you want the world map and I'll add `react-simple-maps`.
2. **Block-on-login**: Supabase Auth doesn't let us reject logins via DB flag alone. Enforcement is: AuthProvider signs out + RLS denies writes for blocked users. They can briefly hit the publishable key, but can't do anything.
3. **Delete user**: requires service role (server fn). Cascades manually since no FKs are declared.
4. **"Enter as Admin"**: I'll route admin to `/dashboard?as=<sellerId>` reading via service role + render the existing dashboard with that seller's data + red banner.
5. **ipapi.co free tier** = 1000/day. For published traffic I recommend switching to `ip-api.com` (45 req/min from same IP, unlimited overall, HTTP-only on free plan — needs HTTPS upgrade or a tiny proxy server fn). I'll wire a server fn `/api/public/geo` that proxies `ip-api.com` server-side so HTTPS + unlimited works. Confirm OK.

### What I'll start with after approval

Phase 1 (migration + IP tracking + admin sidebar shell). Estimated 1 large migration + ~6 new files. After it's in, I'll proceed to Phase 2 unless you redirect.

Shall I proceed with Phase 1?