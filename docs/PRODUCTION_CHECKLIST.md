# Production Checklist — ملعب الوطن (Malaab Al Watan)

This is the single document to follow when taking this project from "code
in a repo" to "running against a real Supabase project." Written for a
developer who has never seen this codebase before.

---

## 1. Prerequisites

- Node.js 20+ and npm
- A Supabase project (free tier is fine to start)
- The [Supabase CLI](https://supabase.com/docs/guides/cli) installed and logged in (`npx supabase login`)

## 2. Apply the database

Migrations must be applied **in filename order** — each one builds on the
previous. Do not skip or reorder them.

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This applies, in order:

| Migration | What it does |
|---|---|
| `20260804000000_phase2_database_architecture.sql` | Core tables, constraints, indexes, RLS |
| `20260804010000_phase3_business_logic.sql` | Settings, payment methods, audit log, the 5 customer-facing RPCs |
| `20260806000000_phase4_storage_setup.sql` | `payment-screenshots` bucket + base RLS |
| `20260808000000_phase4_2_admin_dashboard.sql` | 3 admin-gated dashboard RPCs |
| `20260810000000_phase4_3_closures_and_storage_hardening.sql` | `closed_slots` hardening, bucket file-size/mime limits, tightened upload path validation |
| `20260812000000_phase5_realtime.sql` | Enables Realtime on 4 admin-visible tables |

Then seed the reference data (branches, sections, settings, payment
methods):

```bash
npx supabase db execute -f supabase/seed.sql
# or, with a direct connection string:
psql "$DATABASE_URL" -f supabase/seed.sql
```

**Before going live**, update these two placeholder settings rows (seeded
with dummy values) via the dashboard's Settings page, or directly:

```sql
update settings set value = '"01xxxxxxxxx"' where key = 'vodafone_cash_number';
update settings set value = '"01xxxxxxxxx"' where key = 'whatsapp_number';
```

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill in real values from your
Supabase project's dashboard (Project Settings → API):

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
VITE_SUPABASE_PAYMENTS_BUCKET=payment-screenshots
VITE_APP_NAME=ملعب الوطن
VITE_RESERVATION_LOCK_MINUTES=5
```

`VITE_RESERVATION_LOCK_MINUTES` is a fallback default only — the actual
lock duration used by `create_booking_lock` comes from the
`lock_duration_minutes` row in `settings`, editable from the dashboard.
**Never commit `.env.local`** — it's already gitignored (`*.local`).

## 4. Create the first admin account

There is no self-registration, by design (see `docs/DATABASE.md`). Two steps:

1. **Create an auth user.** Easiest via the Supabase dashboard:
   Authentication → Users → Add user (set a real email + password). Or
   programmatically with the service role key:
   ```ts
   await supabaseAdmin.auth.admin.createUser({
     email: "owner@example.com",
     password: "...",
     email_confirm: true,
   });
   ```
2. **Grant admin access** by inserting into `admin_users`:
   ```sql
   insert into admin_users (user_id, full_name)
   values ('<the auth.users.id from step 1>', 'Owner Name');
   ```

They can now sign in at `/dashboard/login`.

## 5. Storage — what to verify manually

The `payment-screenshots` bucket, its RLS policies, and its bucket-level
`file_size_limit`/`allowed_mime_types` are all created by the migrations
above. What **cannot** be verified from this project's local test suite
(no live Supabase project available during development — see
`docs/ADMIN_DASHBOARD.md` for the detailed reasoning) and needs a real
check after deployment:

1. **As an anonymous customer**, go through the full booking flow and
   upload a real payment screenshot on the payment step. Confirm it
   succeeds and the booking reaches the dashboard's pending-receipts list.
2. **As an admin**, open that booking in the dashboard and confirm the
   receipt image/PDF actually renders (this exercises
   `getReceiptSignedUrl` — a real signed URL from real Supabase Storage).
3. Try uploading a file **over 10MB** and a **disallowed type** (e.g. a
   `.txt` file renamed to `.jpg`, or an actual non-image) — both should
   be rejected, either by the bucket's `file_size_limit`/`allowed_mime_types`
   or by `upload_receipt_metadata`'s own validation.
4. Using a second (different) booking, confirm that booking's receipt is
   not visible to admin under the first booking, and that no customer
   session can list or read any receipt directly (only the admin
   dashboard, via `createSignedUrl`, can).

## 6. Realtime — what to verify manually

`docs/REALTIME.md` explains why only the admin dashboard gets true
Realtime. After deployment:

1. Open the admin Schedule page in two browser tabs (or two admins).
2. In one tab, run a test booking through the customer flow (or create a
   closure from the other admin tab).
3. Confirm the first tab's schedule grid updates within a couple of
   seconds **without a manual refresh**.
4. Do the same for the Overview page's stat cards after a booking/receipt
   change.

## 7. Running the test suite against your own database

```bash
export TEST_DATABASE_URL="postgresql://user:pass@host:5432/dbname"
for f in supabase/migrations/*.sql; do psql "$TEST_DATABASE_URL" -f "$f"; done
psql "$TEST_DATABASE_URL" -f supabase/seed.sql
npm test
```

**Never point this at your production database** — the suite `TRUNCATE`s
transactional tables between test files.

## 8. Build and deploy the frontend

```bash
npm install
npm run build   # outputs to dist/
```

`dist/` is a static site — deploy it to any static host (Vercel,
Netlify, Cloudflare Pages, etc.) with the environment variables from
step 3 configured in that host's dashboard. No server-side rendering or
Node runtime is required.

## 9. Known limitations to revisit after launch

See the "Limitations" sections in `docs/BUSINESS_LOGIC.md`,
`docs/ADMIN_DASHBOARD.md`, and `docs/REALTIME.md` for the full list.
Summary of what's deliberately *not* built yet:

- WhatsApp / SMS notifications (columns exist, sender doesn't)
- Full capability-token verification at the Storage layer (would need an
  Edge Function fronting uploads)
- Deployment automation / CI
- A dashboard-specific 404 page for invalid nested `/dashboard/...` URLs

## 10. Go-live checklist (quick reference)

- [ ] All 6 migrations applied, in order
- [ ] `seed.sql` run
- [ ] `vodafone_cash_number` and `whatsapp_number` updated to real values
- [ ] `.env.local` configured on the hosting platform, not committed
- [ ] First admin account created and confirmed working at `/dashboard/login`
- [ ] Real anonymous upload tested end-to-end (§5 above)
- [ ] Realtime tested end-to-end (§6 above)
- [ ] `npm test` passing against the target database
- [ ] `npm run build` succeeds
- [ ] Non-admin user confirmed blocked from `/dashboard/*` data (sign in
      with a non-admin account, or none at all, and confirm every
      dashboard page shows nothing / redirects)
