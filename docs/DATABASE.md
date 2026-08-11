# Database Architecture — ملعب الوطن (Malaab Al Watan)

**Phase 2 deliverable.** Schema, constraints, indexes, and security only — no
booking UI, no availability-computation endpoints, no dashboard queries.
Those are Phase 3+ and require your approval to start.

Migration file: [`supabase/migrations/20260804000000_phase2_database_architecture.sql`](../supabase/migrations/20260804000000_phase2_database_architecture.sql)
Seed data: [`supabase/seed.sql`](../supabase/seed.sql)

**This entire migration was executed against a real local Postgres 16
instance (matching Supabase's engine version), not just hand-written.**
29 test scenarios were run against it — every constraint, trigger, and RLS
policy described below was actually exercised, and two real bugs were
found and fixed in the process (see [Recommendations](#recommendations-before-implementing-business-logic),
item 1). See the "tested" note under each table.

---

## 1. Table-by-table explanation

### `branches`
The physical locations — currently `فرع مبارك السبعين` and `فرع الأولى`,
both under the `ملعب الوطن` brand. `slug` is a stable, URL/code-safe
identifier (`mubarak-al-sabeen`, `al-oula`); `name` is the Arabic display
name. `is_active` lets you temporarily hide a branch (e.g. permanently
closed) without deleting its historical bookings.

### `field_sections`
The bookable units within a branch: **A** (5v5 half), **B** (5v5 half),
**AB** (7v7 full field). This is the table that makes the schema
*dynamic* — adding a branch means adding rows here, not changing code.
The important, non-obvious column is **`conflicts_with`**: a text array
listing which section codes physically overlap with this one:

| Section | `conflicts_with` | Why |
|---|---|---|
| A | `{A, AB}` | Booking A blocks another A, and blocks AB (AB uses A's half) |
| B | `{B, AB}` | Same, mirrored |
| AB | `{A, B, AB}` | AB occupies both halves — blocks everything |

This one column is what lets a single generic conflict-check trigger (see
§3) correctly enforce "you can't book AB while A or B is already booked,
but A and B can be booked simultaneously by two different groups" — without
hard-coding that rule anywhere in application code.

### `bookings`
One reservation of one `field_section` for one time range. Key design
choices:
- **`starts_at` / `ends_at` are `timestamptz`**, not separate date+time
  columns — avoids timezone/DST ambiguity entirely; Cairo-local
  interpretation happens only inside triggers, never in storage.
- **`booking_date`** is a derived column representing which *operating
  day* (the 14:00→04:00 session) a booking belongs to — a booking at
  01:00 belongs to the *previous* calendar day's session. This is set by
  a trigger, not a `GENERATED` column, because the timezone-aware logic
  it needs is not classified as `IMMUTABLE` by Postgres (a requirement
  for generated columns) — see §3.
- **`total_price_egp` is never trusted from the client.** A trigger
  overwrites it with the section's current `price_egp` on every
  insert/update.
- **`status` always starts `'pending'`** on insert regardless of what the
  client submits — enforced by both a trigger and an RLS `WITH CHECK`
  (defense in depth). Only an admin can move it to `confirmed` /
  `cancelled` / `completed` / `no_show`.
- **`access_token`**: a random, unguessable UUID returned to the
  (anonymous) customer once, at booking creation. It's the only way to
  later attach a payment receipt to that booking — see §4 and
  Recommendation 1.

### `booking_locks`
A temporary hold on a `(field_section, time range)` pair while a customer
is mid-checkout, auto-expiring via `expires_at` (default `now() + 5
minutes`). `session_id` is a client-generated string (e.g. from
`localStorage`), not a real identity — it's just enough to let a browser
recognize "this is my own lock" in Phase 3 UI, without implying any
security guarantee (see Recommendation 4).

### `payment_receipts`
Metadata about an uploaded payment screenshot — **`storage_path` only**,
never binary data (the actual file lives in Supabase Storage, added in
Phase 4). `access_token` must match the parent booking's own token for
the insert to be allowed at all (§4). `review_status` starts `'pending'`
and is moved to `approved`/`rejected` only by an admin. A partial unique
index allows re-upload after a rejection while blocking a second
simultaneous "active" receipt.

### `closed_slots`
Manual closures created by the owner/admin — maintenance, private events,
holidays. `field_section_id` is nullable: `NULL` closes the *entire
branch* for that time range; a specific section id closes just that
section. A trigger guarantees a given section actually belongs to the
given branch (can't accidentally close Al Oula's field using a Mubarak
section id).

---

## 2. ER Diagram (text)

```
┌───────────────┐
│   branches    │
│───────────────│
│ id (PK)       │
│ slug (UQ)     │
│ name          │
│ is_active     │
└───────┬───────┘
        │ 1
        │
        │ N
┌───────▼───────────────┐
│    field_sections      │
│────────────────────────│
│ id (PK)                │
│ branch_id (FK)         │───────────────┐
│ code  (A|B|AB)         │               │
│ field_type (5v5|7v7)   │               │
│ price_egp              │               │
│ conflicts_with[]       │               │
│ UQ(branch_id, code)    │               │
└───────┬────────────────┘               │
        │ 1                              │  (nullable FK — branch-wide
        │                                │   closures skip this)
        │ N                              │
┌───────▼────────────────┐      ┌────────▼─────────────┐
│       bookings          │      │    closed_slots       │
│──────────────────────────│      │───────────────────────│
│ id (PK)                 │      │ id (PK)                │
│ branch_id (FK)          │      │ branch_id (FK)         │
│ field_section_id (FK)   │      │ field_section_id (FK,  │
│ customer_name           │      │   nullable)            │
│ customer_phone          │      │ starts_at / ends_at    │
│ starts_at / ends_at     │      │ during (generated)     │
│ during (generated)      │      │ reason                 │
│ booking_date            │      │ created_by (auth.users) │
│ status                  │      └────────────────────────┘
│ total_price_egp         │
│ access_token (UQ)       │
└───────┬──────────────────┘
        │ 1
        │
        │ N
┌───────▼────────────────┐      ┌────────────────────────┐
│   payment_receipts       │      │     booking_locks        │
│───────────────────────────│      │───────────────────────────│
│ id (PK)                  │      │ id (PK)                  │
│ booking_id (FK, cascade) │      │ field_section_id (FK)    │
│ access_token (must match │      │ branch_id (FK)            │
│   parent booking's token)│      │ session_id (client token) │
│ storage_path              │      │ starts_at / ends_at        │
│ mime_type / file_size     │      │ during (generated)          │
│ review_status              │      │ expires_at                   │
│ reviewed_by (auth.users)  │      └────────────────────────┘
└────────────────────────┘

┌────────────────────┐        ┌──────────────────────────┐
│    admin_users       │        │  auth.users (Supabase)   │
│──────────────────────│◄───────│  managed by Supabase Auth │
│ user_id (PK, FK)      │  1:1  └──────────────────────────┘
│ full_name             │
└────────────────────────┘
        ▲
        │ referenced by is_admin() inside every admin-only RLS policy
```

Cardinality summary:
- `branches (1) → field_sections (N)`
- `field_sections (1) → bookings (N)`, `field_sections (1) → booking_locks (N)`
- `branches (1) → closed_slots (N)`, `field_sections (1, optional) → closed_slots (N)`
- `bookings (1) → payment_receipts (N, but at most one "active" at a time)`
- `auth.users (1) → admin_users (0..1)` — presence of a row = admin

---

## 3. Conflict prevention — how AB vs A/B actually gets enforced

This is the trickiest part of the schema and deserves its own section
since it's not obvious from the DDL alone. Two independent, layered
mechanisms:

**Layer 1 — same-section overlap (race-safe, index-backed):**
```sql
exclude using gist (field_section_id with =, during with &&)
  where (status in ('pending', 'confirmed'))
```
A native Postgres `EXCLUDE` constraint (via `btree_gist`). This is
enforced by the database's own MVCC/locking machinery, so it is safe even
under full concurrency — two simultaneous transactions booking the exact
same section/time cannot both succeed, no race window, no application
code involved.

**Layer 2 — cross-section overlap (A vs AB, B vs AB):**
An `EXCLUDE` constraint can't easily express "conflicts with a *different
row's* section code" declaratively, so this is a `BEFORE INSERT/UPDATE`
trigger (`bookings_prevent_cross_section_conflicts`) that:
1. Takes an **advisory lock scoped to the branch**
   (`pg_advisory_xact_lock(hashtextextended(branch_id, 0))`) — this is
   what makes the trigger race-safe too, by serializing concurrent
   conflict-checks for the same branch (unrelated branches are unaffected
   and unblocked).
2. Looks up `conflicts_with` for the section being booked.
3. Checks for overlapping **bookings**, **closed_slots**, and **live
   booking_locks** on any section whose code is in that array.
4. Raises an exception if any conflict is found.

The same pattern (minus the EXCLUDE layer, since locks are swept on
every insert instead) protects `booking_locks`.

**Tested:** creating an `AB` booking while an `A` booking exists on the
same time range is blocked; creating a `B` booking at the same time as an
existing `A` booking succeeds (they're independent halves); a lock on `B`
blocks a conflicting `AB` lock attempt; an admin closure blocks a new
booking in that window.

---

## 4. Suggested indexes (all included in the migration)

| Table | Index | Purpose |
|---|---|---|
| `branches` | `branches_slug_key` (unique) | Fast lookup by slug; also enforces uniqueness |
| `field_sections` | `field_sections_branch_code_key` (unique) | Enforces one row per (branch, A/B/AB); doubles as lookup index |
| `field_sections` | `field_sections_branch_id_idx` | Listing a branch's sections |
| `field_sections` | `field_sections_is_active_idx` (partial) | Filtering active sections only |
| `bookings` | `bookings_no_overlap_same_section` (GiST EXCLUDE) | Race-safe overlap prevention **and** a fast overlap-lookup index |
| `bookings` | `bookings_during_gist_idx` (GiST) | "What overlaps this range" queries beyond the exclusion constraint's own scope (e.g. across all statuses) |
| `bookings` | `bookings_branch_id_idx`, `bookings_field_section_id_idx` | Standard FK join indexes |
| `bookings` | `bookings_status_idx` | Dashboard filtering (pending review, confirmed, etc.) |
| `bookings` | `bookings_booking_date_idx`, `bookings_branch_date_idx` | Calendar views, "bookings today", per-branch daily analytics |
| `bookings` | `bookings_customer_phone_idx` | Admin lookup of a customer's booking history |
| `bookings` | `bookings_access_token_key` (unique) | Capability-token lookups (Phase 3 RPC) |
| `booking_locks` | `booking_locks_no_overlap_same_section` (GiST EXCLUDE) | Same-section race-safe protection |
| `booking_locks` | `booking_locks_expires_at_idx` | Efficient cleanup sweeps (`WHERE expires_at <= now()`) |
| `booking_locks` | `booking_locks_session_id_idx`, `booking_locks_branch_id_idx` | Lookup by owning session / branch |
| `payment_receipts` | `payment_receipts_one_active_per_booking_idx` (partial unique) | At most one pending/approved receipt per booking |
| `payment_receipts` | `payment_receipts_booking_id_idx`, `payment_receipts_review_status_idx` | FK join + admin review queue |
| `closed_slots` | `closed_slots_during_gist_idx` (GiST) | Overlap lookups |
| `closed_slots` | `closed_slots_branch_id_idx`, `closed_slots_field_section_id_idx` | FK joins |

---

## 5. Row Level Security — summary

| Table | `anon` | `authenticated` (non-admin) | `authenticated` (admin) |
|---|---|---|---|
| `branches` | SELECT active only | SELECT active only | full access |
| `field_sections` | SELECT active only | SELECT active only | full access |
| `bookings` | **INSERT only** (forced `status='pending'`) | same as anon | full access (SELECT/UPDATE/DELETE) |
| `booking_locks` | **INSERT only** | same as anon | SELECT + DELETE |
| `payment_receipts` | **INSERT only**, and only if `access_token` matches the parent booking | same as anon | full access |
| `closed_slots` | no access | no access | full access |
| `admin_users` | no access | no access (unless self = admin) | SELECT |
| `unavailable_slots` (view) | SELECT (no PII: branch/section/time range only) | SELECT | SELECT |

Every table has `FORCE ROW LEVEL SECURITY` enabled, so even the table
owner can't accidentally read past these rules outside of an explicit
`SECURITY DEFINER` function. `service_role` (used only by trusted
server-side code, never the browser) bypasses RLS entirely, as intended
for Supabase service-role usage.

**Why anon can't directly `SELECT` `bookings`/`booking_locks`/`closed_slots`:**
those tables (or their non-PII columns) are exposed instead through the
`public.unavailable_slots` view — a `UNION` of live bookings, live locks,
and closures, projecting only `branch_id`, `field_section_id`,
`starts_at`, `ends_at`. No customer name, phone, price, or closure reason
is ever visible to an anonymous request. This satisfies "read available
booking slots" without any PII exposure.

**Tested:** a non-admin authenticated user gets `0` rows (not an error)
querying `bookings` — the table-level grant exists, RLS just filters
everything out. An admin sees full rows including `customer_name` and
`customer_phone`.

---

## 6. Recommendations before implementing business logic

### 1. Booking creation must go through a `SECURITY DEFINER` RPC, not a raw table INSERT — confirmed by testing, not a guess

This is the most important finding from actually running the migration.
`INSERT ... RETURNING` requires the *inserting role* to have `SELECT`
privilege on the table, evaluated under that role's own grants — **not**
the elevated privilege of any `SECURITY DEFINER` trigger that ran during
the insert. Since `anon` deliberately has no `SELECT` grant on `bookings`
(to protect other customers' names/phones), a raw
`supabase.from('bookings').insert(...).select()` call from the frontend
will insert the row successfully but **fail to return it** (`permission
denied for table bookings`) — I hit and reproduced this exact error while
testing.

**The row itself is created correctly either way** (confirmed by
inspecting it as admin afterward) — only the client-side read-back fails.

Two similar cases exist for the same underlying reason: an inline `EXISTS`
subquery inside an RLS `WITH CHECK` clause also runs under the calling
role's privileges. The `payment_receipts_insert_public` policy needed a
small `SECURITY DEFINER` helper function
(`booking_access_token_matches`) instead of an inline subquery against
`bookings`, for the same reason.

**Recommendation:** Phase 3 should expose booking creation as a Postgres
function (e.g. `public.create_booking(...)`, `SECURITY DEFINER`) that
performs the insert internally and explicitly returns only
`{ id, access_token, starts_at, ends_at, total_price_egp }` — never a
`SELECT`/`RETURNING` against the raw table from the client. This is also
the natural place to atomically delete the customer's `booking_locks` row
and insert the `bookings` row in one transaction (see item 2).

### 2. Converting a lock into a booking should be one atomic RPC call
The lock-conflict trigger checks for *other* unexpired locks when a
booking is inserted, but it has no way to know "this insert is the same
customer redeeming their own lock" versus "a totally new booking that
happens to land in a free slot." The clean way to handle this: a single
`SECURITY DEFINER` function that, in one transaction, deletes the
matching `booking_locks` row (scoped by `field_section_id` + time range +
`session_id`) and inserts the `bookings` row. Doing this as two separate
client-side calls would reintroduce a race window between them.

### 3. Expired lock cleanup: fine now, revisit at scale
Locks are swept opportunistically on every new lock insert
(`DELETE FROM booking_locks WHERE expires_at <= now()`), which is
sufficient at this scale (two branches, a handful of concurrent
customers). If usage grows significantly, consider a scheduled cleanup
via `pg_cron` (available as a Supabase extension) instead of relying
solely on insert-triggered sweeps:
```sql
select cron.schedule('cleanup-expired-locks', '* * * * *',
  $$delete from public.booking_locks where expires_at <= now()$$);
```

### 4. `booking_locks.session_id` is a UX convenience, not a security boundary
Anyone can insert a lock claiming any `session_id`, and there is
currently no `SELECT`/`UPDATE`/`DELETE` policy letting a customer query
or release *their own* lock by `session_id` (locks are admin-only to
read/delete). This is intentional for Phase 2: a lock can't be
maliciously read or hijacked because it can't be read by `anon` at all.
If Phase 3 wants "release my hold early" as a feature, it should be a
`SECURITY DEFINER` RPC that takes `(field_section_id, session_id)` and
only deletes a lock matching both — not a direct RLS-based `DELETE`
grant.

### 5. Egypt's DST assumption is hard-coded as a fixed +2h offset
`bookings_set_derived_fields` uses `starts_at + interval '2 hours'`
rather than `starts_at AT TIME ZONE 'Africa/Cairo'`, specifically because
named-timezone conversions are `STABLE` (not `IMMUTABLE`) in Postgres and
the working-hours check needed to live in a trigger anyway. Egypt
currently observes no DST. If that changes again, this fixed offset (and
the equivalent assumption anywhere in the frontend) needs a coordinated
update — it will not silently adjust itself the way a named-timezone
conversion would.

### 6. `price_egp` changes are not retroactive, by design
Since `total_price_egp` is captured on the booking at creation time (not
recomputed from `field_sections` afterward), changing a section's price
later never alters historical bookings' recorded prices. This is
almost certainly what you want for financial record-keeping, but worth
confirming explicitly.

### 7. No automatic status transition from receipt approval → booking confirmation
Deliberately left as a manual admin action for this phase (update
`bookings.status` directly) rather than auto-syncing it from
`payment_receipts.review_status`, to keep Phase 2 scoped to schema/
constraints only. Worth considering as a small trigger in Phase 3 once
the review workflow is designed.

### 8. Verify the migration-running role's privileges in real Supabase
The `SECURITY DEFINER` functions are owned by whichever role runs the
migration (`postgres` via the Supabase CLI/dashboard in normal use),
which needs to be able to bypass the `FORCE ROW LEVEL SECURITY` on these
tables for the functions to work as tested here. This is Supabase's
default setup and required no special configuration in this sandbox's
local Postgres 16 instance; worth a quick smoke test against your actual
project after applying the migration, using the same test queries in
§7 below.

### 9. `field_sections.field_type` and `conflicts_with` are currently trusted, hand-seeded data
If you ever add a branch with a genuinely different layout (e.g. three
independent thirds instead of two halves), `conflicts_with` is where that
logic lives — no code changes needed elsewhere, just correct seed data
for the new sections.

---

## 7. How this was verified (for your own re-testing)

29 scenarios were run against a local Postgres 16 instance seeded with
this exact migration + seed file, covering: normal booking creation,
same-section overlap rejection, cross-section (A vs AB) overlap
rejection, independent-halves (A + B) success, operating-hours rejection,
server-side price/status enforcement against a tampered payload,
overnight `booking_date` rollover (both directions), lock cross-section
conflicts, receipt access-token matching (correct/wrong token, duplicate
active receipt, oversized file), RLS as `anon` / non-admin authenticated
/ admin authenticated, closed-slot blocking, and several `CHECK`
constraint violations (bad slug, bad section code, negative price, bad
phone format, over-long booking). Two real bugs were caught this way
(§6, item 1, plus a `tg_op` case-sensitivity bug) and fixed before this
document was written — not left for you to discover in production.

If you have the Supabase CLI locally, the equivalent workflow is:
```bash
supabase db reset   # applies migrations/ then seed.sql
```
