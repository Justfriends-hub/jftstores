# Export conversation history + security audit

## 1. Export history (CSV)

Add an **Export CSV** button next to the existing History toggle on every conversation row (customer list, seller dashboard, admin view — all use the same actions component).

- Clicking it downloads `conversation-history-<id>.csv` with one row per status/system event: date/time, actor ("You" / other party), and the event text.
- Export uses the same history the panel already loads, so it always matches what is on screen; if history has not been opened yet it is fetched first.
- The button is hidden while loading and disabled when there are no events.
- Values are CSV-escaped (quotes, commas, newlines) and the file gets a UTF-8 BOM so Excel opens Naira/accented text correctly.

### Technical notes
- Extend `src/components/chat/conversation-activity.tsx`: reuse the `listConversationActivity` server function, add a `toCsv` helper plus a Blob + object-URL download. No new server function, no schema change.
- Server side stays as-is: `listConversationActivity` is already auth-gated and reads through the user's own RLS-scoped client, so a user can only export a conversation they belong to.

## 2. Security audit (report only, no code changes)

After the export ships, run the three audits from your notes against this codebase and report findings in chat with file + line, exploit in one line, and a suggested fix. Nothing gets changed until you approve the fix list.

- **Endpoint auth:** enumerate every `createServerFn` in `src/lib/*.functions.ts` and confirm each one (a) requires a verified session before its first side effect, (b) derives `userId`/role from the verified session rather than the request payload, and (c) re-checks admin/seller ownership server-side before any `supabaseAdmin` (RLS-bypassing) call — client-side route guards do not count. Also confirm there are no unauthenticated HTTP routes under `src/routes/api/`.
- **Secrets:** check that no secret key is hardcoded or exposed behind a `VITE_` prefix, that only publishable values reach the browser bundle, and that server-only values are read inside handlers via `process.env`. Values are never printed — findings reference variable names only.
- **SEO crawlability:** this app server-renders every route, so the "empty shell" problem does not apply. The check here is per-route metadata hygiene (unique title/description, canonical, OG/Twitter, robots + sitemap) rather than adding a prerender step.

Deliverable: a findings list, ordered by severity, plus a proposed fix batch you can approve.
