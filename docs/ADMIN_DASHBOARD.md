# Admin Dashboard — ملعب الوطن (Malaab Al Watan)

**Phase 4.2 deliverable.** Full admin dashboard for the two branches:
Overview, Bookings management, daily Schedule, Revenue + popular hours,
and Settings. Built entirely on the existing database/RLS/service-layer
architecture — see `docs/DATABASE.md` and `docs/BUSINESS_LOGIC.md` for
what it builds on.

Migration: [`supabase/migrations/20260808000000_phase4_2_admin_dashboard.sql`](../supabase/migrations/20260808000000_phase4_2_admin_dashboard.sql)
Tests: [`tests/rpc/adminDashboard.test.ts`](../tests/rpc/adminDashboard.test.ts) — 13 tests, all passing against real Postgres.

---

## Creating the first admin (required before the dashboard is usable)

There is no self-registration flow, by design (Phase 2). Two manual steps
against your Supabase project:

1. Create a user via Supabase Auth (dashboard → Authentication → Add
   user, or `supabase.auth.admin.createUser(...)` from a trusted
   server-side context).
2. Grant them admin access:
   ```sql
   insert into admin_users (user_id, full_name)
   values ('<their auth.users.id>', 'Owner Name');
   ```

They can then log in at `/dashboard/login`.

---

## What was added

### New RPCs (3, all admin-gated)
Only where real server-side computation was needed. Everything else
(bookings list, receipt review, settings edit) is a **plain table
read/update** through existing Phase 2 admin RLS policies — no new RPC,
per the instruction not to introduce a parallel confirmation workflow.

- **`get_admin_overview_stats()`** — today's bookings/revenue, totals,
  pending receipts, confirmed/cancelled counts. "Today" is computed via
  the existing `compute_session_window()` (same operating-day rollback
  logic as `booking_date`) — see the bug note below.
- **`get_admin_schedule(branch_id, date)`** — full A/B/AB grid
  (available/locked/booked/closed) for one branch/day, including which
  customer occupies a slot. Reuses the exact `conflicts_with` semantics
  from the booking-conflict triggers, so a booking on A correctly shows
  AB as "booked" (with the same customer attributed) while B stays
  independent — the frontend never re-derives this.
- **`get_admin_revenue_report(from_date, to_date, branch_id?)`** — total
  revenue, revenue by branch, revenue by field type, and the most-booked
  hours, all for the date range requested.

Every function explicitly checks `is_admin()` itself (defense in depth)
in addition to being grant-restricted to `authenticated` only — **never**
`anon`. New functions default to `PUBLIC EXECUTE` in Postgres regardless
of Phase 3's earlier revoke (that revoke wasn't retroactive), so each one
is individually locked down again in this migration.

### New tables
None. This migration only adds functions — no new columns or tables were
needed.

### TypeScript service layer (`src/services/admin/`)
`adminStatsService.ts`, `adminScheduleService.ts`, `adminBookingsService.ts`,
`adminReceiptsService.ts`, `adminSettingsService.ts` — one file per
concern, matching the existing `src/services/rpc/` pattern. Components
never call Supabase directly.

### Authentication (`src/context/AuthContext.tsx`)
Tracks the Supabase Auth session and calls the real `is_admin()` RPC to
determine admin status — never a hardcoded/client-side-only check. This
matters for *why* it's safe: even if `AdminGuard` (the route-level
redirect) were somehow bypassed, every actual data read/write is
**independently** protected by RLS. The frontend check is a UX
convenience (redirect to `/dashboard/login`), not the security boundary.

### UI (`src/pages/dashboard/*`, `src/components/dashboard/*`)
RTL, Arabic-first, sidebar on desktop / bottom nav on mobile
(`DashboardLayout.tsx`). Deliberately does **not** touch
`src/components/layout/*` (the public-site English layout) — dashboard
routes sit in their own tree in `src/router/index.tsx`, outside
`AppLayout`.

---

## Two real bugs found by testing, fixed before shipping

1. **`get_admin_overview_stats`'s "today" was wrong during the
   after-midnight portion of a session.** The first version computed
   "today" as a naive `(now() + 2h)::date`, which doesn't roll back to
   the previous calendar day the way `booking_date` does. During roughly
   00:00–04:00 Cairo time, this would show the *next* day's (empty)
   stats instead of the ongoing session's. Fixed by calling
   `compute_session_window(now())` — the exact same function `bookings`
   already uses — instead of re-deriving the logic. Confirmed via a
   direct `now()` vs `compute_session_window` comparison at the time of
   the bug (see git history / migration comments).
2. **`withAuthenticated` test helper never actually worked.** `SET
   request.jwt.claim.sub = $1` is not valid Postgres syntax — `SET`
   doesn't accept bind parameters. This helper was written in Phase 3 but
   never exercised by any test until this milestone's admin tests tried
   to use it. Fixed with `select set_config(...)`, which does support
   parameters. Also found via testing: `TRUNCATE auth.users CASCADE` in
   an early draft of the new test file emptied `settings` and
   `payment_methods` too (any table with a nullable FK to `auth.users`
   gets fully truncated by `CASCADE`, regardless of that FK's own
   `ON DELETE` action) — fixed by only truncating `admin_users`.

---

## Phase 4.3: Closed Slots management + Storage hardening

Migration: [`20260810000000_phase4_3_closures_and_storage_hardening.sql`](../supabase/migrations/20260810000000_phase4_3_closures_and_storage_hardening.sql)
Tests: [`tests/rpc/closures.test.ts`](../tests/rpc/closures.test.ts) (13 tests), [`tests/rpc/storageSecurity.test.ts`](../tests/rpc/storageSecurity.test.ts) (9 tests) — all passing locally.

### Closed slots: reviewed, no new RPC needed

The existing `closed_slots_admin_all` RLS policy (Phase 2) — `for all to
authenticated using(is_admin()) with check(is_admin())` — combined with
the existing `closed_slots_time_order_check` constraint and
`closed_slots_validate_section_branch` trigger, already fully covers
"only admins can create/delete a closure, the time range must be valid,
and a section must belong to its branch." A new `SECURITY DEFINER` RPC
here would duplicate protection RLS and constraints already provide, not
add any — so `src/services/admin/adminClosuresService.ts` uses plain
`.from("closed_slots")` calls, same pattern as the other admin services.

The one real gap found: `created_by` was a plain nullable column with no
server-side default, so it wasn't reliably populated. Fixed with
`alter table closed_slots alter column created_by set default auth.uid()`
— the simplest correct fix, verified: creating a closure without
specifying `created_by` at all now correctly stores the calling admin's
real id.

### Storage hardening

Three changes, reviewing the Phase 4 bucket setup for production-readiness:

1. **Bucket-level `file_size_limit` / `allowed_mime_types`** — the
   original bucket had neither set. These are enforced by Supabase's
   storage-api service *before* any RLS policy or application code runs,
   a meaningfully stronger guarantee than only checking client-side and
   inside `upload_receipt_metadata`'s metadata row (a crafted request
   could otherwise upload an oversized/wrong-type file directly to
   Storage, bypassing both). Now set to 10MB / the same 4 mime types the
   `payment_receipts` check constraint already allows.
2. **Tightened upload path validation.** Previously any path under
   `receipts/` was accepted by the INSERT policy. Now the second path
   segment must be a UUID matching an *existing* booking (via a new
   `SECURITY DEFINER` helper, `is_valid_receipt_upload_path`, same
   pattern as `booking_access_token_matches`). This does **not** verify
   `access_token` ownership at the storage layer — full capability-token
   rigor there would need a custom Edge Function fronting uploads
   (documented as a limitation in the original Phase 4 migration and
   still true here). What it does close off: uploading to a completely
   made-up/nonexistent path. Tested directly: valid path → succeeds;
   made-up booking id, wrong prefix, extra nested segments, non-UUID
   segment → all correctly rejected.
3. **Receipt viewing remains admin-only**, unchanged from Phase 4 —
   `payment_screenshots_select_admin_only`. No customer, including the
   one who uploaded a given receipt, has any `SELECT` policy on
   `storage.objects` at all. This is stricter than "can't see *another*
   customer's receipt" — no customer can see *any* receipt via direct
   Storage access, satisfying that requirement by construction. Viewing
   happens exclusively through `adminReceiptsService.getReceiptSignedUrl()`,
   which only an authenticated admin can successfully call.

### ⚠️ What still requires testing against a real Supabase project

**This is the most important limitation to read before relying on the
customer payment-upload flow in production.**

While testing the tightened storage RLS policy locally, I found that a
raw SQL `INSERT ... RETURNING` into `storage.objects` as `anon` fails
with a permission error — **not** because the policy logic is wrong (the
same insert without `RETURNING` succeeds, and the policy's `WITH CHECK`
expression evaluates to `true` when tested standalone), but because
`RETURNING` requires SELECT-level visibility on the row, which `anon`
correctly lacks (no `SELECT` policy exists for `anon` on
`storage.objects`, by design). This is the exact same class of issue
Phase 2 found with `bookings` — confirmed by direct, repeatable testing
against local Postgres.

**What I could not verify:** whether Supabase's actual storage-api
service (a separate application, not part of Postgres/PostgREST) is
internally affected by this same limitation when handling
`supabase.storage.from(bucket).upload(...)` calls — i.e., whether the
real client-side upload flow built in Milestone 1
(`src/services/receiptStorageService.ts`) actually works end-to-end for
anonymous customers against a live Supabase project.

Reasons for cautious optimism, not proof: this exact pattern
(anon-can-insert, admin-only-select on `storage.objects`) is Supabase's
own documented standard pattern for "public upload, private read," used
very widely — if it were fundamentally broken this way, it would be a
well-known, frequently-reported issue. But I have no live Supabase
project in this sandbox to actually exercise `supabase.storage.upload()`
end-to-end, so I am not claiming this works — only that the RLS
*policies themselves* are correct and tested at the SQL level.

**Action needed on your end:** before launch, actually perform a receipt
upload from the deployed frontend (or a simple test script using the
`@supabase/supabase-js` Storage client, not raw SQL) against your real
Supabase project, as an anonymous user, and confirm it succeeds. If it
does not, the architectural fix is the same one already noted as a
Phase 3 recommendation for full capability-token rigor: mediate uploads
through a small Edge Function (running with the service role) instead of
a direct client-side Storage call — which would sidestep this class of
issue entirely regardless of its root cause.

### New admin UI
`src/components/dashboard/CreateClosureModal.tsx` (branch/section/time/reason
form — section choice is A / B / AB / whole-branch, reason is
Maintenance / Private event / Holiday / Other with free text) and
`ClosuresList.tsx` (existing closures for the selected day, with delete).
Both live on the existing Schedule page (`src/pages/dashboard/Schedule.tsx`)
and invalidate the `["admin","schedule"]` query on create/delete so the
grid reflects a new closure immediately — the RPC's own conflict logic
(cross-section attribution, branch-wide vs section-specific) is what
computes the resulting grid; nothing about closures is re-derived in
React.

### Bugs found and fixed via testing (Phase 4.3)

1. **`closed_slots.created_by` was never reliably populated** — fixed
   with a column `DEFAULT auth.uid()` (see above).
2. **Local storage-schema stub bug**: my `storage.foldername()` stub
   (written in Milestone 1) didn't match real Supabase's actual behavior
   — it returned the filename as part of the array instead of excluding
   it. This didn't matter for Milestone 1's simple `[1] = 'receipts'`
   check, but would have silently broken the new 2-segment path
   validation. Fixed the stub to match Supabase's real
   `storage.foldername()` definition before testing the new policy.
3. **Test bug, not an app bug**: an early version of the new storage
   tests used `INSERT ... RETURNING` to verify a successful anon upload,
   which fails for the reason explained above — this is a property of
   raw SQL via `pg`, not of the actual `supabase.storage.upload()` client
   call the app uses. Fixed the test to verify success by checking as
   admin afterward instead of relying on `RETURNING`.
4. **Reversed time range surfaces as `22000` (data_exception), not
   `23514` (check_violation)** — the generated `during
   tstzrange(starts_at, ends_at, '[)')` column enforces `lower <= upper`
   at construction time, before `closed_slots_time_order_check` itself
   even runs. Confirmed directly against Postgres. Data integrity is
   still fully enforced either way; only the specific error code differs
   from what a first guess would assume.

- **Booking status transitions are unconstrained**, exactly matching
  the existing backend (Phase 3 deliberately left this as a manual
  admin action with no state-machine enforcement beyond the status enum
  — see `docs/BUSINESS_LOGIC.md` §6 recommendation 7). The dashboard
  exposes all 5 statuses as buttons rather than inventing a restricted
  workflow not present in the schema.
- **Anonymous customer receipt uploads have not been verified against a
  live Supabase project** — see the ⚠️ section above. The RLS policies
  are correct and tested at the SQL level; whether the actual
  `supabase.storage.upload()` call succeeds end-to-end for an anonymous
  customer against real Supabase Storage is unverified.
- **No dashboard-specific 404** — an invalid nested `/dashboard/...` URL
  falls through to the public site's `NotFound` page (English layout)
  rather than a dashboard-styled one. Cosmetic only.
- Storage-layer capability-token verification (matching a receipt file
  to the exact `access_token` used for its metadata row) still isn't
  possible without a custom Edge Function — the tightened path
  validation added in Phase 4.3 only confirms the booking exists, not
  that the uploader is entitled to it. Same documented limitation since
  Phase 4, narrowed but not eliminated.
- WhatsApp and deployment remain untouched, as instructed. Realtime is
  now implemented for the dashboard (Phase 5) — see `docs/REALTIME.md`.
