# Business Logic Engine — ملعب الوطن (Malaab Al Watan)

**Phase 3 deliverable.** SECURITY DEFINER RPCs + TypeScript service layer +
integration test suite. Still no booking UI, no dashboard — those are
Phase 4+.

Migration: [`supabase/migrations/20260804010000_phase3_business_logic.sql`](../supabase/migrations/20260804010000_phase3_business_logic.sql)
(builds on [Phase 2's migration](../supabase/migrations/20260804000000_phase2_database_architecture.sql))
Service layer: [`src/services/`](../src/services)
Tests: [`tests/rpc/`](../tests/rpc) — **54 tests, all passing**, run against
a real local Postgres 16 instance (not mocks) with both migrations + seed
data applied. See [Testing](#testing) below to run them yourself.

---

## 1. Why RPCs, not direct table access

Phase 2 let `anon` `INSERT` directly into `bookings`/`booking_locks`/
`payment_receipts` via RLS, as a stopgap. Phase 3 **removes that** —
`DROP POLICY` + `REVOKE INSERT` for all three, anon and authenticated
alike. The 5 RPCs below, all `SECURITY DEFINER`, are now the *only* way to
create a lock, confirm a booking, or upload a receipt. This closes a real
gap Phase 2 flagged in its own recommendations: raw `INSERT ... RETURNING`
never worked for anon anyway (it lacks `SELECT` on `bookings`); RPCs solve
that naturally since they return exactly the fields they choose to,
never relying on `RETURNING`.

A second hardening pass revokes Postgres's **default** `PUBLIC EXECUTE`
grant on every function in `public`, then re-grants only:
- the 5 RPCs, to `anon` + `authenticated`
- `is_admin()`, because RLS policies invoke it *under the querying role's
  own privileges* (not elevated), so it must stay directly callable.

Everything else — `compute_session_window`, `log_booking_event`,
`generate_booking_reference`, `booking_access_token_matches`, all trigger
functions — is **not** directly callable via `supabase.rpc(...)` anymore.
They only ever run inside another `SECURITY DEFINER` function's context or
as part of a trigger firing, both of which execute as the function/table
owner regardless of `PUBLIC`'s grants. **Tested**: a raw
`select public.compute_session_window(now())` as `anon` now fails with
`permission denied` (`42501`), while `create_booking_lock` — which calls
it internally — still works fine.

---

## 2. The 5 RPCs

### `create_booking_lock(field_section_id, starts_at, ends_at, session_id) → jsonb`
Places a temporary hold (default 5 minutes, from `settings.lock_duration_minutes`).
Validates: section exists & active, time range within operating hours
(settings-driven), no conflict with existing bookings/locks/closures —
including cross-section (A blocks AB, etc). Returns
`{ lock_id, expires_at, countdown_seconds }`.

### `release_booking_lock(lock_id, session_id) → jsonb`
Deletes **only** a lock matching both `id` and `session_id` — one session
can never release another's hold. Returns `{ released: true, lock_id }`.

### `confirm_booking(lock_id, session_id, customer_name, customer_phone, intended_payment_method?, notes?) → jsonb`
The heart of the system. Atomically: row-locks and verifies the caller's
own lock (`FOR UPDATE`), checks it hasn't expired, deletes it, generates a
unique `booking_reference`, and inserts the `bookings` row (status starts
`pending`). Any failure anywhere rolls back the *entire* operation,
including the lock deletion — the customer never loses their hold on a
failed attempt (except a genuinely expired one, see §5). Returns
`{ booking_id, booking_reference, access_token, price, status }`.

**Naming note:** despite the name, this does **not** set
`status = 'confirmed'`. It converts a *lock* into a real *booking record*
(`status = 'pending'`). Moving to `confirmed` remains a separate admin
action (Phase 4 dashboard) after reviewing the payment receipt — matching
the status workflow in §4.

### `upload_receipt_metadata(booking_id, access_token, storage_path, payment_method, mime_type, file_size_bytes) → jsonb`
Records receipt **metadata only** — the actual file upload to Supabase
Storage happens separately (Phase 4); this just links a `storage_path`
string to a booking. Requires `access_token` to match the booking's own
(capability-token pattern from Phase 2). Validates payment method is
active, file ≤ 10MB, mime type is one of the 4 supported image/PDF types.
Returns `{ receipt_id, review_status: 'pending' }`.

### `get_available_slots(field_section_id, date?) → { slot_start, slot_end }[]`
Generates candidate slots (default 60-minute granularity, from
`settings.slot_granularity_minutes`) across the day's operating window,
excluding anything overlapping a booking/lock/closure on this section
**or a physically conflicting one** (A's booking removes that slot from
AB's results too). The frontend must call this — it never computes
availability itself.

---

## 3. Error handling — one consistent contract

Every RPC raises real Postgres exceptions with a specific SQLSTATE
(never a `200`-with-error-shaped-body). The TypeScript service layer
(`src/services/rpc/errors.ts`) maps each one to a stable `kind` the UI can
switch on:

| SQLSTATE | Meaning | `BookingErrorKind` |
|---|---|---|
| `23P01` | exclusion_violation — slot already booked/held/closed | `conflict` |
| `23505` | unique_violation — duplicate active receipt, or reference retry exhausted | `conflict` |
| `23514` | check_violation — outside operating hours, inactive section | `validation` |
| `22023` | invalid_parameter_value — bad input (blank name, inactive payment method, etc.) | `validation` |
| `23503` | foreign_key_violation — field_section_id/booking_id doesn't exist | `not_found` |
| `P0002` | no_data_found — lock missing, wrong session, or expired | `lock_invalid` |
| `42501` | insufficient_privilege — access_token didn't match | `unauthorized` |

```ts
import { createBookingLock, BookingServiceError } from "@/services/rpc";

try {
  const lock = await createBookingLock({ fieldSectionId, startsAt, endsAt, sessionId });
} catch (e) {
  if (e instanceof BookingServiceError && e.kind === "conflict") {
    // show "this slot was just taken" — refresh availability
  }
}
```

---

## 4. Booking status workflow

```
(booking_locks row exists)  "LOCKED"
        │  confirm_booking()
        ▼
     PENDING            ← bookings row created here, status='pending'
        │  admin reviews payment_receipts, approves        (Phase 4)
        ▼
     CONFIRMED
        │  after the match is played                        (Phase 4)
        ▼
     COMPLETED

  Optional, from PENDING or CONFIRMED, admin-initiated (Phase 4):
     CANCELLED
     NO_SHOW
```

"LOCKED" is not a `bookings.status` value — it's the `booking_locks` row's
existence. There is no direct `bookings.status` transition function yet
(Phase 4 territory); admins will update `status` via the dashboard,
subject to Phase 2's `bookings_admin_write` RLS policy. Every status
transition is logged automatically (see §6) regardless of which future
code path performs it.

---

## 5. A subtle, tested design decision: the expired-lock event

`confirm_booking`'s expired-lock branch does **not** call
`log_booking_event` before raising its exception. An earlier version did,
and testing proved it was dead code: the whole function call is one
transaction, so raising an exception rolls back *everything* written
earlier in that same call — including the log entry that was supposed to
explain why it failed. The row is left in place (harmless — it's already
excluded everywhere expiry is checked) and gets swept and correctly
logged as `LOCK_EXPIRED` by the next `create_booking_lock` call's cleanup
step instead. This is documented in the migration file itself at the
exact line it matters.

---

## 6. Settings-driven configuration (no hardcoded values)

`public.settings` (key → `jsonb` value, `is_public` gates anon visibility):

| key | example value | used by |
|---|---|---|
| `working_hours` | `{"open_hour":14,"close_hour":4,"timezone_offset_hours":2}` | `compute_session_window`, `compute_window_for_date` |
| `lock_duration_minutes` | `5` | `create_booking_lock` |
| `slot_granularity_minutes` | `60` | `get_available_slots` |
| `brand_name` | `"ملعب الوطن"` | frontend display |
| `vodafone_cash_number` | placeholder — **replace before launch** | frontend display |
| `whatsapp_number` | placeholder — **replace before launch** | future notification sender |
| `branch_visibility_mode` | `"active_only"` | reserved; `branches.is_active` is authoritative today |

`public.payment_methods` (lookup table, not a hardcoded list): only
`vodafone_cash` is `is_active = true` today; `instapay`, `orange_cash`,
`bank_transfer` exist as inactive rows — enabling one later is a data
change (`UPDATE payment_methods SET is_active = true ...`), not a
migration.

Changing `working_hours` or `lock_duration_minutes` takes effect
immediately for every subsequent RPC call — no redeploy.

---

## 7. Audit log (`booking_events`)

Append-only, admin-read-only, written exclusively by
`log_booking_event()` (a `SECURITY DEFINER` function — no role has a
direct `INSERT` grant, not even admins). Two ways events get logged:

1. **Automatically**, via `AFTER INSERT`/`AFTER UPDATE` triggers —
   `BOOKING_CREATED` (any insert into `bookings`, regardless of code
   path), `BOOKING_CONFIRMED`/`CANCELLED`/`COMPLETED`/`NO_SHOW` (any
   `status` change on `bookings`), `PAYMENT_UPLOADED` (any insert into
   `payment_receipts`). This means Phase 4's dashboard doesn't need to
   remember to log anything when it changes a booking's status — it's
   covered automatically.
2. **Explicitly**, inside the RPCs — `LOCK_CREATED`, `LOCK_RELEASED`,
   and `LOCK_EXPIRED` (the latter logged when `booking_locks_prevent_conflicts`
   sweeps stale rows before creating a new lock).

---

## 8. Booking reference generation

`WTN-YYYYMMDD-000001` — date is the Cairo-local date the booking was
*confirmed* (not the session date it's *for*), sequence resets daily,
generated atomically via `INSERT ... ON CONFLICT (ref_date) DO UPDATE
... RETURNING`, which Postgres guarantees is race-safe (the conflicting
counter row is locked for the update's duration). **Tested under real
concurrency**: 5 truly-parallel `confirm_booking` calls all received
distinct, strictly sequential references with zero duplicates or gaps.

---

## 9. Frontend service layer

`src/services/rpc/` — one file per RPC, all wrapped by
`src/services/rpc/index.ts`. `src/services/settingsService.ts` and
`src/services/paymentMethodsService.ts` wrap the two plain (non-RPC)
public tables. **No component should ever call `supabase.from(...)` or
`supabase.rpc(...)` directly** — Phase 4 UI work should only ever import
from `@/services`.

```ts
import { createBookingLock, confirmBooking, getAvailableSlots } from "@/services/rpc";
import { getOrCreateSessionId } from "@/lib/session";

const sessionId = getOrCreateSessionId();
const slots = await getAvailableSlots({ fieldSectionId, date: "2026-09-01" });
const lock = await createBookingLock({ fieldSectionId, startsAt, endsAt, sessionId });
const booking = await confirmBooking({
  lockId: lock.lockId,
  sessionId,
  customerName,
  customerPhone,
  intendedPaymentMethod: "vodafone_cash",
});
```

`src/types/database.types.ts` was upgraded from Phase 2's empty
placeholder to a hand-written type matching the real schema (still not
generated from a live Supabase project — see the note at the top of that
file). Getting this right required working around a genuine TypeScript
quirk: `interface` declarations don't satisfy postgrest-js's
`Record<string, unknown>`-based structural checks the way an identical
`type` alias does — every row shape is a `type`, not an `interface`,
because of this.

---

## 10. Testing

**54 tests, 8 files, all passing.** These are integration tests — real
SQL against a real Postgres instance with both migrations + seed data
applied, not mocks. They cover every scenario the Phase 3 brief asked
for, plus more found along the way:

| File | Covers |
|---|---|
| `createBookingLock.test.ts` | happy path, operating-hours validation, same-section conflict |
| `releaseBookingLock.test.ts` | ownership enforcement, double-release, unblocking a conflict |
| `confirmBooking.test.ts` | happy path, wrong session, double-confirm, **expired lock**, reference format/sequencing, price integrity |
| `conflictRules.test.ts` | **every** A/B/AB combination from the brief, both directions, plus branch independence |
| `uploadReceiptMetadata.test.ts` | access-token check, **duplicate upload**, oversized file, inactive payment method, bad mime type |
| `getAvailableSlots.test.ts` | full-day generation, exclusion after booking, cross-section exclusion, independent-halves non-exclusion |
| `concurrency.test.ts` | **two users racing the same slot** (genuinely parallel, not simulated), **booking reference uniqueness under 5-way real concurrency**, branch-scoped locks don't block each other |
| `securityHardening.test.ts` | internal helpers blocked from direct anon calls, `is_admin()` still callable, direct table inserts now blocked, settings/payment_methods visibility |

### Running the tests yourself

```bash
# 1. Point Postgres CLI tools at a disposable database and apply the schema
psql "$TEST_DATABASE_URL" -f supabase/migrations/20260804000000_phase2_database_architecture.sql
psql "$TEST_DATABASE_URL" -f supabase/migrations/20260804010000_phase3_business_logic.sql
psql "$TEST_DATABASE_URL" -f supabase/seed.sql

# 2. Run the suite
TEST_DATABASE_URL="postgresql://user:pass@host:5432/dbname" npm test
```

`TEST_DATABASE_URL` defaults to `postgresql://postgres:postgres@127.0.0.1:5432/malaab_test`
if unset. **Never point this at a production database** — tests
`TRUNCATE` transactional tables between runs.

`npm run test:watch` runs Vitest in watch mode for iterating on new
tests/RPCs.

---

## 11. Recommendations before Phase 4 (UI)

1. **Realtime for the countdown/availability grid.** `create_booking_lock`
   returns `countdown_seconds`, but nothing pushes an update when a slot
   becomes locked/booked by someone else. Consider Supabase Realtime on
   `bookings`/`booking_locks` (admins can subscribe directly; anon would
   need a realtime-safe view mirroring `unavailable_slots`, since anon
   still can't subscribe to the raw tables).
2. **`get_available_slots` is per-section, per-day.** A calendar UI
   showing all 3 sections at once will need 3 calls (or a small wrapper
   RPC that returns all sections for a branch in one round-trip) —
   deliberately left as a Phase 4 UI-layer decision, not pre-built here.
3. **Storage bucket + upload flow not built yet.** `upload_receipt_metadata`
   only records the `storage_path` string; actually uploading the file to
   Supabase Storage (bucket creation, storage RLS policies, client-side
   upload call producing that path) is Phase 4 work.
4. **No admin RPCs yet.** Dashboard actions (confirm a booking, review a
   receipt, create a manual/walk-in booking, close a slot) will need
   their own RPCs or direct table access under Phase 2's existing
   admin RLS policies — not designed here since "do not build the
   dashboard yet" was explicit in this phase's brief.
5. **WhatsApp integration remains unbuilt, as instructed** — only the
   `notification_status`/`notification_sent_at`/`notification_error`
   columns exist, defaulting to `'not_sent'`. A future sender just needs
   to update those three columns; nothing else in the schema changes.
