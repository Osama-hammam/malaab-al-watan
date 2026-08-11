-- =============================================================================
-- ملعب الوطن (Malaab Al Watan) — Football Field Booking System
-- Phase 2: Database Architecture
-- =============================================================================
-- Scope: schema, constraints, indexes, triggers (conflict prevention / data
-- integrity only), and Row Level Security. NO application/booking-UI logic,
-- no availability-computation RPCs, no admin dashboard queries — those are
-- Phase 3+.
--
-- Design notes (see docs/DATABASE.md for the full write-up):
--  * All timestamps are `timestamptz` (stored in UTC). "Africa/Cairo" is
--    UTC+2 with no DST currently observed, applied via a fixed interval
--    inside triggers (not a named zone) so the logic stays predictable.
--  * Every table gets `created_at` / `updated_at`, auto-maintained.
--  * Booking conflict prevention is defense-in-depth:
--      1. A GiST EXCLUDE constraint (race-safe at the DB level) blocks two
--         overlapping bookings on the *same* field section.
--      2. A trigger (serialized per-branch via an advisory lock) blocks
--         overlaps *across* related sections — e.g. booking "AB" must
--         conflict with an existing "A" or "B" booking on the same branch,
--         since AB physically occupies both halves.
-- =============================================================================


-- =============================================================================
-- 0. EXTENSIONS
-- =============================================================================

-- gen_random_uuid() is built into Postgres 13+, but pgcrypto is enabled
-- anyway since Supabase projects ship with it by default and some
-- environments still expect it explicitly.
create extension if not exists pgcrypto;

-- Required for GiST EXCLUDE constraints over plain equality columns
-- (uuid, text) combined with range types (tstzrange).
create extension if not exists btree_gist;


-- =============================================================================
-- 1. SHARED HELPERS
-- =============================================================================

-- Generic "touch updated_at" trigger, reused by every table below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Sets updated_at = now() on every UPDATE. Attached to all tables with an updated_at column.';


-- =============================================================================
-- 2. ADMIN IDENTITY (used by RLS policies to gate the dashboard)
-- =============================================================================

-- Deliberately simple: an authenticated Supabase user (auth.users row) is an
-- "admin" if their id appears here. Grant/revoke admin access by inserting
-- or deleting a row — no custom JWT claims to manage.
create table public.admin_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now()
);

comment on table public.admin_users is
  'Whitelist of auth.users who may access the admin dashboard. Presence of a row = admin.';

-- SECURITY DEFINER + fixed search_path: safe to call from RLS policies,
-- immune to search_path hijacking, and runs with the privileges needed to
-- read admin_users regardless of the calling role's own RLS visibility.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

comment on function public.is_admin() is
  'True if the currently authenticated user (auth.uid()) is a whitelisted admin.';


-- =============================================================================
-- 3. BRANCHES
-- =============================================================================

create table public.branches (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null,
  name        text not null,          -- Arabic branch name, e.g. 'فرع مبارك السبعين'
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint branches_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint branches_slug_key unique (slug),
  constraint branches_name_not_blank check (btrim(name) <> '')
);

comment on table public.branches is
  'A physical Malaab Al Watan branch/location (e.g. Mubarak Al Sab''een, Al Oula). Add rows here to open a new branch.';

create trigger branches_set_updated_at
  before update on public.branches
  for each row execute function public.set_updated_at();


-- =============================================================================
-- 4. FIELD SECTIONS  (A / B / AB per branch)
-- =============================================================================

create table public.field_sections (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches (id) on delete cascade,
  code            text not null,
  field_type      text not null,
  price_egp       integer not null,
  -- Section codes that CANNOT be booked at the same time as this one
  -- (always includes the section's own code). Drives cross-section
  -- conflict prevention: A -> {A,AB}, B -> {B,AB}, AB -> {A,B,AB}.
  conflicts_with  text[] not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint field_sections_code_check check (code in ('A', 'B', 'AB')),
  constraint field_sections_field_type_check check (field_type in ('5v5', '7v7')),
  constraint field_sections_price_positive check (price_egp > 0),
  constraint field_sections_conflicts_not_empty check (array_length(conflicts_with, 1) > 0),
  constraint field_sections_branch_code_key unique (branch_id, code)
);

comment on table public.field_sections is
  'The bookable units within a branch: A (5v5 half), B (5v5 half), AB (7v7 full field = both halves combined).';
comment on column public.field_sections.conflicts_with is
  'Section codes within the same branch that overlap physically with this one and must not be double-booked.';

create trigger field_sections_set_updated_at
  before update on public.field_sections
  for each row execute function public.set_updated_at();

create index field_sections_branch_id_idx on public.field_sections (branch_id);
create index field_sections_is_active_idx on public.field_sections (is_active) where is_active;


-- =============================================================================
-- 5. BOOKINGS
-- =============================================================================

create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.branches (id) on delete restrict,
  field_section_id  uuid not null references public.field_sections (id) on delete restrict,

  customer_name     text not null,
  customer_phone    text not null,

  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  -- Derived, immutable-safe generated range column. Used by the EXCLUDE
  -- constraint below and available for fast overlap queries from the app.
  during            tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

  -- Which operating "day" this session belongs to. Because the branch is
  -- open 14:00 -> 04:00 (crossing midnight), a 01:00 booking conceptually
  -- belongs to the *previous* calendar day's session. Populated by trigger
  -- (see bookings_set_derived_fields) rather than GENERATED, because the
  -- calculation needs a BEFORE-trigger-safe (non-generated-column) context.
  booking_date      date not null,

  status            text not null default 'pending',
  total_price_egp   integer not null,
  notes             text,

  -- Opaque bearer token handed back to the (anonymous) customer when the
  -- booking is created. Required later to upload a payment receipt or look
  -- up this specific booking, since there is no authenticated identity to
  -- scope RLS to otherwise. Never exposed in any list/read endpoint.
  access_token      uuid not null default gen_random_uuid(),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint bookings_status_check
    check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  constraint bookings_time_order_check check (ends_at > starts_at),
  constraint bookings_duration_check
    check (ends_at - starts_at between interval '30 minutes' and interval '6 hours'),
  constraint bookings_price_positive check (total_price_egp > 0),
  constraint bookings_customer_name_not_blank check (btrim(customer_name) <> ''),
  -- Loose E.164-ish check: digits, optional leading +, 8-15 digits total.
  -- Intentionally not Egypt-specific so branches can serve other countries later.
  constraint bookings_customer_phone_format check (customer_phone ~ '^\+?[0-9]{8,15}$'),
  constraint bookings_access_token_key unique (access_token)
);

comment on table public.bookings is
  'A reservation of one field section for one time range. status starts at "pending" and is advanced to "confirmed" by an admin after reviewing the payment receipt.';
comment on column public.bookings.booking_date is
  'The operating day (Cairo local) this session belongs to; sessions after midnight roll back to the previous day.';
comment on column public.bookings.access_token is
  'Anonymous-customer bearer token returned once at booking creation; required to upload a payment receipt or fetch this booking later.';

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- Race-safe same-section overlap protection. Only rows with a "live"
-- status compete for the slot; cancelled/no-show bookings free it up.
alter table public.bookings
  add constraint bookings_no_overlap_same_section
  exclude using gist (
    field_section_id with =,
    during with &&
  )
  where (status in ('pending', 'confirmed'));

create index bookings_branch_id_idx on public.bookings (branch_id);
create index bookings_field_section_id_idx on public.bookings (field_section_id);
create index bookings_status_idx on public.bookings (status);
create index bookings_booking_date_idx on public.bookings (booking_date);
create index bookings_branch_date_idx on public.bookings (branch_id, booking_date);
create index bookings_customer_phone_idx on public.bookings (customer_phone);
-- Fast "is this range free / what overlaps it" lookups beyond the exclusion index.
create index bookings_during_gist_idx on public.bookings using gist (during);


-- =============================================================================
-- 6. BOOKING LOCKS  (temporary 5-minute holds)
-- =============================================================================

create table public.booking_locks (
  id                uuid primary key default gen_random_uuid(),
  field_section_id  uuid not null references public.field_sections (id) on delete cascade,
  branch_id         uuid not null references public.branches (id) on delete cascade,

  -- Anonymous client-generated identifier (e.g. stored in localStorage) so
  -- the same browser session can be recognised as the owner of its own
  -- lock. Not a security boundary by itself — see docs/DATABASE.md.
  session_id        text not null,

  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  during            tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

  expires_at        timestamptz not null default (now() + interval '5 minutes'),
  created_at        timestamptz not null default now(),

  constraint booking_locks_time_order_check check (ends_at > starts_at),
  constraint booking_locks_session_id_not_blank check (btrim(session_id) <> '')
);

comment on table public.booking_locks is
  'Temporary (5 minute) hold on a field section + time range while a customer completes checkout. Expired rows are inert and periodically swept.';
comment on column public.booking_locks.session_id is
  'Client-generated identifier, not a Supabase auth identity — anonymous users have none.';

-- Same defense-in-depth pattern as bookings: fast same-section race-safe
-- protection via EXCLUDE. Expired locks are swept just before every insert
-- (see prevent_lock_conflicts trigger) so this index only ever needs to
-- reflect "live" rows in practice.
alter table public.booking_locks
  add constraint booking_locks_no_overlap_same_section
  exclude using gist (
    field_section_id with =,
    during with &&
  );

create index booking_locks_expires_at_idx on public.booking_locks (expires_at);
create index booking_locks_session_id_idx on public.booking_locks (session_id);
create index booking_locks_branch_id_idx on public.booking_locks (branch_id);


-- =============================================================================
-- 7. PAYMENT RECEIPTS
-- =============================================================================

-- Used by the payment_receipts INSERT policy below. RLS policy expressions
-- run with the *querying* role's own privileges — an inline EXISTS
-- subquery against bookings would fail for anon the same way a plain
-- SELECT would, since anon deliberately has no SELECT grant on bookings.
-- Wrapping the check in a SECURITY DEFINER function (same pattern as
-- is_admin()) lets the check run with elevated privilege while anon still
-- cannot query bookings directly.
create or replace function public.booking_access_token_matches(p_booking_id uuid, p_access_token uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.bookings
     where id = p_booking_id
       and access_token = p_access_token
  );
$$;

comment on function public.booking_access_token_matches(uuid, uuid) is
  'True if p_access_token matches the given booking''s access_token. Lets anon prove capability to act on a booking (e.g. upload its receipt) without ever being granted SELECT on bookings.';

create table public.payment_receipts (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references public.bookings (id) on delete cascade,
  -- Must match bookings.access_token for the same booking_id — enforced by
  -- RLS WITH CHECK on insert (see section 9). Prevents anyone who merely
  -- guesses/increments a booking_id from attaching a receipt to it.
  access_token     uuid not null,

  storage_path     text not null,
  mime_type        text not null,
  file_size_bytes  integer not null,

  review_status    text not null default 'pending',
  reviewed_by      uuid references auth.users (id) on delete set null,
  reviewed_at      timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint payment_receipts_review_status_check
    check (review_status in ('pending', 'approved', 'rejected')),
  constraint payment_receipts_mime_type_check
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  constraint payment_receipts_file_size_check
    check (file_size_bytes > 0 and file_size_bytes <= 10 * 1024 * 1024), -- 10 MB
  constraint payment_receipts_storage_path_not_blank check (btrim(storage_path) <> ''),
  constraint payment_receipts_reviewed_consistency
    check (
      (review_status = 'pending' and reviewed_by is null and reviewed_at is null)
      or (review_status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
    )
);

comment on table public.payment_receipts is
  'A payment screenshot/proof uploaded by the customer for a booking, stored in Supabase Storage (storage_path only — no binary data here).';

create trigger payment_receipts_set_updated_at
  before update on public.payment_receipts
  for each row execute function public.set_updated_at();

-- At most one "active" (pending or approved) receipt per booking. A
-- rejected receipt stays in the table as history and does not block a
-- fresh upload.
create unique index payment_receipts_one_active_per_booking_idx
  on public.payment_receipts (booking_id)
  where (review_status in ('pending', 'approved'));

create index payment_receipts_booking_id_idx on public.payment_receipts (booking_id);
create index payment_receipts_review_status_idx on public.payment_receipts (review_status);


-- =============================================================================
-- 8. CLOSED SLOTS  (manual closures by the owner/admin)
-- =============================================================================

create table public.closed_slots (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.branches (id) on delete cascade,
  -- NULL = closes the entire branch (all sections) for the time range.
  -- Set   = closes only that specific section.
  field_section_id  uuid references public.field_sections (id) on delete cascade,

  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  during            tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

  reason            text,
  created_by        uuid references auth.users (id) on delete set null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint closed_slots_time_order_check check (ends_at > starts_at),
  constraint closed_slots_section_matches_branch check (true) -- enforced by trigger below
);

comment on table public.closed_slots is
  'Admin-initiated closures (maintenance, private events, holidays). field_section_id NULL closes the whole branch; set closes just that section.';

create trigger closed_slots_set_updated_at
  before update on public.closed_slots
  for each row execute function public.set_updated_at();

create index closed_slots_branch_id_idx on public.closed_slots (branch_id);
create index closed_slots_field_section_id_idx on public.closed_slots (field_section_id);
create index closed_slots_during_gist_idx on public.closed_slots using gist (during);

-- Guard against a mismatched (branch_id, field_section_id) pair — the
-- section, if given, must actually belong to the given branch.
create or replace function public.closed_slots_validate_section_branch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.field_section_id is not null then
    if not exists (
      select 1 from public.field_sections fs
      where fs.id = new.field_section_id and fs.branch_id = new.branch_id
    ) then
      raise exception 'field_section_id % does not belong to branch_id %',
        new.field_section_id, new.branch_id
        using errcode = '23514'; -- check_violation
    end if;
  end if;
  return new;
end;
$$;

create trigger closed_slots_validate_section_branch
  before insert or update on public.closed_slots
  for each row execute function public.closed_slots_validate_section_branch();


-- =============================================================================
-- 9. BUSINESS-INTEGRITY TRIGGERS (bookings)
-- =============================================================================

-- ----- 9a. Derive booking_date, recompute price server-side, validate window -----
--
-- Runs BEFORE INSERT/UPDATE so anonymous clients cannot: (1) submit a
-- fabricated total_price_egp, (2) submit a status other than 'pending' on
-- insert, or (3) book outside the 14:00 -> 04:00 operating window.
create or replace function public.bookings_set_derived_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cairo_start   timestamptz;
  v_session_date  date;
  v_window_start  timestamptz;
  v_window_end    timestamptz;
  v_price         integer;
  v_section_active boolean;
  v_section_branch uuid;
begin
  -- Force a safe status on brand-new rows regardless of client payload.
  if tg_op = 'INSERT' then
    new.status := 'pending';
  end if;

  -- Look up the section's price + active flag + owning branch; also
  -- guarantees field_section_id actually exists and is bookable.
  select price_egp, is_active, branch_id
    into v_price, v_section_active, v_section_branch
    from public.field_sections
   where id = new.field_section_id;

  if not found then
    raise exception 'field_section_id % does not exist', new.field_section_id
      using errcode = '23503'; -- foreign_key_violation
  end if;

  if not v_section_active then
    raise exception 'This field section is not currently bookable' using errcode = '23514';
  end if;

  if new.branch_id is distinct from v_section_branch then
    raise exception 'branch_id does not match the branch of field_section_id'
      using errcode = '23514';
  end if;

  -- Price is always derived server-side — never trust client input.
  new.total_price_egp := v_price;

  -- Egypt currently observes UTC+2 with no DST. Fixed-offset arithmetic
  -- (rather than `AT TIME ZONE 'Africa/Cairo'`) keeps this logic simple
  -- and independent of the tzdata database. Revisit if Egypt's DST policy
  -- changes again (see docs/DATABASE.md recommendations).
  v_cairo_start := new.starts_at + interval '2 hours';

  if extract(hour from v_cairo_start) < 14 then
    v_session_date := (v_cairo_start - interval '1 day')::date;
  else
    v_session_date := v_cairo_start::date;
  end if;

  new.booking_date := v_session_date;

  -- Operating window in Cairo local time, converted back to UTC instants.
  v_window_start := (v_session_date::timestamp + time '14:00') - interval '2 hours';
  v_window_end   := ((v_session_date + 1)::timestamp + time '04:00') - interval '2 hours';

  if new.starts_at < v_window_start or new.ends_at > v_window_end then
    raise exception
      'Booking must fall within operating hours (2:00 PM - 4:00 AM). Requested % -> %',
      new.starts_at, new.ends_at
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.bookings_set_derived_fields() is
  'Derives booking_date, recomputes total_price_egp from field_sections (never trusts client input), forces status=pending on insert, and enforces the 14:00-04:00 operating window.';

create trigger bookings_set_derived_fields
  before insert or update of field_section_id, branch_id, starts_at, ends_at
  on public.bookings
  for each row execute function public.bookings_set_derived_fields();


-- ----- 9b. Cross-section conflict prevention (A/B vs AB) -----
--
-- The EXCLUDE constraint on bookings (section 5) already blocks two
-- overlapping bookings on the *same* section, race-safe. This trigger
-- additionally blocks overlaps *across* the sections listed in
-- field_sections.conflicts_with (e.g. booking "AB" must conflict with an
-- existing "A" booking on the same branch/time). An advisory lock scoped
-- to the branch serializes concurrent attempts so this check is race-safe
-- too, without locking unrelated branches.
create or replace function public.bookings_prevent_cross_section_conflicts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conflicts_with text[];
  v_during         tstzrange;
  v_conflict_id    uuid;
begin
  -- Serialize conflict checks per branch so two concurrent transactions
  -- can't both pass the SELECT below before either commits.
  perform pg_advisory_xact_lock(hashtextextended(new.branch_id::text, 0));

  select conflicts_with into v_conflicts_with
    from public.field_sections
   where id = new.field_section_id;

  v_during := tstzrange(new.starts_at, new.ends_at, '[)');

  -- Conflicting confirmed/pending bookings on related sections.
  select b.id into v_conflict_id
    from public.bookings b
    join public.field_sections fs on fs.id = b.field_section_id
   where fs.branch_id = new.branch_id
     and fs.code = any (v_conflicts_with)
     and b.status in ('pending', 'confirmed')
     and b.id <> new.id
     and tstzrange(b.starts_at, b.ends_at, '[)') && v_during
   limit 1;

  if v_conflict_id is not null then
    raise exception 'This time range conflicts with an existing booking (%).', v_conflict_id
      using errcode = '23P01'; -- exclusion_violation
  end if;

  -- Conflicting closed slots (branch-wide or on a related section).
  if exists (
    select 1
      from public.closed_slots cs
      left join public.field_sections fs on fs.id = cs.field_section_id
     where cs.branch_id = new.branch_id
       and (cs.field_section_id is null or fs.code = any (v_conflicts_with))
       and tstzrange(cs.starts_at, cs.ends_at, '[)') && v_during
  ) then
    raise exception 'This time range is closed by the venue.' using errcode = '23P01';
  end if;

  -- Conflicting *unexpired* locks held by someone else. The intended app
  -- flow converts a lock into a booking atomically (delete the lock, then
  -- insert the booking, in one transaction/RPC — see docs/DATABASE.md),
  -- so by the time this runs the customer's own lock should already be
  -- gone.
  if exists (
    select 1
      from public.booking_locks bl
      join public.field_sections fs on fs.id = bl.field_section_id
     where fs.branch_id = new.branch_id
       and fs.code = any (v_conflicts_with)
       and bl.expires_at > now()
       and tstzrange(bl.starts_at, bl.ends_at, '[)') && v_during
  ) then
    raise exception 'This time range is temporarily held by another customer.'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

comment on function public.bookings_prevent_cross_section_conflicts() is
  'Blocks bookings that overlap an existing booking/closure/live lock on a physically related section (A<->AB, B<->AB), serialized per branch via advisory lock.';

create trigger bookings_prevent_cross_section_conflicts
  before insert or update of field_section_id, starts_at, ends_at, status
  on public.bookings
  for each row
  when (new.status in ('pending', 'confirmed'))
  execute function public.bookings_prevent_cross_section_conflicts();


-- =============================================================================
-- 10. BUSINESS-INTEGRITY TRIGGERS (booking_locks)
-- =============================================================================

create or replace function public.booking_locks_prevent_conflicts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conflicts_with text[];
  v_section_branch uuid;
  v_during         tstzrange;
  v_conflict_id    uuid;
begin
  -- Opportunistic cleanup: purge stale locks first so overlap checks
  -- (and the EXCLUDE constraint) only ever see live rows. At this scale
  -- (two branches) a light per-insert sweep is sufficient; see
  -- docs/DATABASE.md for a pg_cron-based alternative at higher scale.
  delete from public.booking_locks where expires_at <= now();

  select conflicts_with, branch_id into v_conflicts_with, v_section_branch
    from public.field_sections
   where id = new.field_section_id;

  if not found then
    raise exception 'field_section_id % does not exist', new.field_section_id
      using errcode = '23503';
  end if;

  new.branch_id := v_section_branch;

  perform pg_advisory_xact_lock(hashtextextended(new.branch_id::text, 0));

  v_during := tstzrange(new.starts_at, new.ends_at, '[)');

  select b.id into v_conflict_id
    from public.bookings b
    join public.field_sections fs on fs.id = b.field_section_id
   where fs.branch_id = new.branch_id
     and fs.code = any (v_conflicts_with)
     and b.status in ('pending', 'confirmed')
     and tstzrange(b.starts_at, b.ends_at, '[)') && v_during
   limit 1;

  if v_conflict_id is not null then
    raise exception 'This time range is already booked (%).', v_conflict_id
      using errcode = '23P01';
  end if;

  if exists (
    select 1
      from public.closed_slots cs
      left join public.field_sections fs on fs.id = cs.field_section_id
     where cs.branch_id = new.branch_id
       and (cs.field_section_id is null or fs.code = any (v_conflicts_with))
       and tstzrange(cs.starts_at, cs.ends_at, '[)') && v_during
  ) then
    raise exception 'This time range is closed by the venue.' using errcode = '23P01';
  end if;

  if exists (
    select 1
      from public.booking_locks bl
      join public.field_sections fs on fs.id = bl.field_section_id
     where fs.branch_id = new.branch_id
       and fs.code = any (v_conflicts_with)
       and bl.expires_at > now()
       and tstzrange(bl.starts_at, bl.ends_at, '[)') && v_during
  ) then
    raise exception 'This time range is already held by another customer.'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

comment on function public.booking_locks_prevent_conflicts() is
  'Sweeps expired locks, then blocks a new lock that would overlap an existing booking/closure/live lock on a physically related section.';

create trigger booking_locks_prevent_conflicts
  before insert on public.booking_locks
  for each row execute function public.booking_locks_prevent_conflicts();


-- =============================================================================
-- 11. PUBLIC-SAFE AVAILABILITY VIEW
-- =============================================================================

-- Anonymous users need to know which (section, time range) combinations are
-- unavailable, but must never see customer names/phones, closure reasons,
-- or receipt data. This view exposes only the columns needed to render a
-- calendar/slot picker. It is owned by a role that is not subject to the
-- RLS policies on the underlying tables (see docs/DATABASE.md), so it can
-- safely read across bookings/booking_locks/closed_slots while only ever
-- *projecting* non-sensitive columns.
create view public.unavailable_slots as
  select
    fs.branch_id,
    b.field_section_id,
    b.starts_at,
    b.ends_at,
    'booking'::text as source
  from public.bookings b
  join public.field_sections fs on fs.id = b.field_section_id
  where b.status in ('pending', 'confirmed')
  union all
  select
    bl.branch_id,
    bl.field_section_id,
    bl.starts_at,
    bl.ends_at,
    'lock'::text as source
  from public.booking_locks bl
  where bl.expires_at > now()
  union all
  select
    cs.branch_id,
    cs.field_section_id,
    cs.starts_at,
    cs.ends_at,
    'closed'::text as source
  from public.closed_slots cs;

comment on view public.unavailable_slots is
  'PII-free union of bookings + live locks + closures, for rendering public availability. field_section_id is NULL for a branch-wide closure.';


-- =============================================================================
-- 12. ROW LEVEL SECURITY
-- =============================================================================

alter table public.admin_users      enable row level security;
alter table public.branches         enable row level security;
alter table public.field_sections   enable row level security;
alter table public.bookings         enable row level security;
alter table public.booking_locks    enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.closed_slots     enable row level security;

-- Force RLS even for the table owner, so a misconfigured connection role
-- can never accidentally bypass it (service_role explicitly has BYPASSRLS
-- and is unaffected by this).
alter table public.admin_users      force row level security;
alter table public.branches         force row level security;
alter table public.field_sections   force row level security;
alter table public.bookings         force row level security;
alter table public.booking_locks    force row level security;
alter table public.payment_receipts force row level security;
alter table public.closed_slots     force row level security;

-- ----- admin_users: admins only, and only readable (managed via SQL/dashboard) -----
create policy admin_users_select_admin_only
  on public.admin_users for select
  to authenticated
  using (public.is_admin());

-- ----- branches: public can read active branches; admins have full control -----
create policy branches_select_public_active
  on public.branches for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

create policy branches_admin_write
  on public.branches for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----- field_sections: same pattern as branches -----
create policy field_sections_select_public_active
  on public.field_sections for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

create policy field_sections_admin_write
  on public.field_sections for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----- bookings -----
-- No SELECT policy for anon/authenticated non-admins: raw bookings (with
-- customer name/phone) are never directly queryable by the public. They
-- consume public.unavailable_slots instead. A booking's own creator can
-- still get its data back via the INSERT statement's RETURNING clause in
-- the same request/transaction, and later via the access_token flow
-- (Phase 3 RPC) — RLS SELECT policies can't express "the row I just
-- inserted", so that lookup is deliberately handled by a SECURITY DEFINER
-- function later, not raw table access.
create policy bookings_select_admin_only
  on public.bookings for select
  to authenticated
  using (public.is_admin());

create policy bookings_insert_public
  on public.bookings for insert
  to anon, authenticated
  with check (status = 'pending');

create policy bookings_admin_write
  on public.bookings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy bookings_admin_delete
  on public.bookings for delete
  to authenticated
  using (public.is_admin());

-- ----- booking_locks -----
-- No SELECT policy at all for anon: locks are ephemeral implementation
-- detail. The client that created a lock already knows its id/expiry from
-- the INSERT response; there's no legitimate need to query them back, and
-- exposing them would let anyone watch live contention on a slot.
create policy booking_locks_insert_public
  on public.booking_locks for insert
  to anon, authenticated
  with check (true);

create policy booking_locks_select_admin_only
  on public.booking_locks for select
  to authenticated
  using (public.is_admin());

create policy booking_locks_admin_delete
  on public.booking_locks for delete
  to authenticated
  using (public.is_admin());

-- ----- payment_receipts -----
-- Anon can upload (insert) a receipt, but only if access_token matches the
-- referenced booking's own access_token — the capability-token check
-- described in section 5/7. No SELECT for anon: receipts are reviewed by
-- admins only.
create policy payment_receipts_insert_public
  on public.payment_receipts for insert
  to anon, authenticated
  with check (
    review_status = 'pending'
    and public.booking_access_token_matches(booking_id, access_token)
  );

create policy payment_receipts_select_admin_only
  on public.payment_receipts for select
  to authenticated
  using (public.is_admin());

create policy payment_receipts_admin_write
  on public.payment_receipts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----- closed_slots: fully admin-only; public consumes unavailable_slots -----
create policy closed_slots_admin_all
  on public.closed_slots for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- =============================================================================
-- 13. GRANTS
-- =============================================================================
-- RLS restricts *rows*; GRANTs are still required to permit the operation
-- at all. Column-level privileges are intentionally uniform (RLS is the
-- real gate) except where a view narrows the columns.

grant select on public.branches, public.field_sections to anon, authenticated;
grant insert on public.bookings to anon, authenticated;
grant insert on public.booking_locks to anon, authenticated;
grant insert on public.payment_receipts to anon, authenticated;
grant select on public.unavailable_slots to anon, authenticated;

grant select, insert, update, delete on
  public.branches,
  public.field_sections,
  public.bookings,
  public.booking_locks,
  public.payment_receipts,
  public.closed_slots,
  public.admin_users
  to authenticated;

-- service_role (used by trusted server-side code / Edge Functions) bypasses
-- RLS by role attribute already; grants here are for completeness.
grant select, insert, update, delete on all tables in schema public to service_role;
