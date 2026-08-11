-- =============================================================================
-- ملعب الوطن (Malaab Al Watan) — Football Field Booking System
-- Phase 3: Business Logic Engine
-- =============================================================================
-- Builds on 20260804000000_phase2_database_architecture.sql. No booking UI,
-- no dashboard. This migration:
--   1. Adds config tables (settings, payment_methods) so working hours, lock
--      duration, brand name, and payment channels are data, not code.
--   2. Adds booking_events (audit log) + automatic logging triggers.
--   3. Adds booking_reference generation (WTN-YYYYMMDD-000001, atomic/unique).
--   4. Adds notification_* columns to bookings (future WhatsApp integration).
--   5. Replaces the two Phase 2 trigger functions that need to become
--      settings-driven instead of hardcoded (bookings_set_derived_fields,
--      booking_locks_prevent_conflicts) via CREATE OR REPLACE.
--   6. Adds 5 SECURITY DEFINER RPCs: create_booking_lock, release_booking_lock,
--      confirm_booking, upload_receipt_metadata, get_available_slots.
--   7. TIGHTENS security: anon can no longer INSERT into bookings/
--      booking_locks/payment_receipts directly — only via the RPCs above.
--      Also revokes Postgres's default PUBLIC EXECUTE grant on every
--      function and re-grants only what must be externally callable.
-- =============================================================================


-- =============================================================================
-- 1. SETTINGS  (config, not hardcoded values)
-- =============================================================================

create table public.settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  is_public   boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

comment on table public.settings is
  'Single source of truth for tunable config: working hours, lock duration, brand name, payment/WhatsApp numbers, etc. is_public controls anon SELECT visibility.';

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;
alter table public.settings force row level security;

create policy settings_select_public_or_admin
  on public.settings for select
  to anon, authenticated
  using (is_public = true or public.is_admin());

create policy settings_admin_write
  on public.settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.settings to anon, authenticated;
grant select, insert, update, delete on public.settings to authenticated;


-- =============================================================================
-- 2. PAYMENT METHODS  (config-driven, "future ready" per requirements)
-- =============================================================================

create table public.payment_methods (
  code        text primary key,
  label_ar    text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.payment_methods is
  'Supported payment channels. Only vodafone_cash is active today; instapay/orange_cash/bank_transfer exist so enabling them later is a data change, not a migration.';

create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

alter table public.payment_methods enable row level security;
alter table public.payment_methods force row level security;

create policy payment_methods_select_active_or_admin
  on public.payment_methods for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

create policy payment_methods_admin_write
  on public.payment_methods for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.payment_methods to anon, authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;


-- =============================================================================
-- 3. BOOKING REFERENCE GENERATION  (WTN-YYYYMMDD-000001, atomic, unique forever)
-- =============================================================================

-- One row per calendar day; last_seq is incremented atomically via
-- INSERT ... ON CONFLICT ... DO UPDATE, which Postgres guarantees is
-- race-safe under concurrent transactions (the conflicting row is locked
-- for the duration of the UPDATE).
create table public.booking_reference_counters (
  ref_date  date primary key,
  last_seq  integer not null default 0
);

comment on table public.booking_reference_counters is
  'Internal counter backing generate_booking_reference(). One row per day; never queried directly by the app.';

alter table public.booking_reference_counters enable row level security;
alter table public.booking_reference_counters force row level security;
-- No policies at all: this table has zero legitimate direct readers/writers
-- outside the SECURITY DEFINER function below (which, as the table owner,
-- is unaffected by RLS). Not even admins need to see it.


-- =============================================================================
-- 4. BOOKING EVENTS  (audit log)
-- =============================================================================

create table public.booking_events (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references public.bookings (id) on delete cascade,
  -- No FK to booking_locks: lock rows are deleted (released/expired/
  -- consumed) as part of normal operation, but their audit trail must
  -- survive that deletion.
  lock_id     uuid,
  event_type  text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),

  constraint booking_events_event_type_check check (event_type in (
    'LOCK_CREATED', 'LOCK_RELEASED', 'LOCK_EXPIRED',
    'BOOKING_CREATED', 'PAYMENT_UPLOADED', 'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED', 'BOOKING_COMPLETED', 'BOOKING_NO_SHOW'
  )),
  constraint booking_events_booking_or_lock_check check (booking_id is not null or lock_id is not null)
);

comment on table public.booking_events is
  'Append-only audit log. Written exclusively by SECURITY DEFINER functions/triggers — no role has direct INSERT access, including admins.';

create index booking_events_booking_id_idx on public.booking_events (booking_id);
create index booking_events_event_type_idx on public.booking_events (event_type);
create index booking_events_created_at_idx on public.booking_events (created_at);

alter table public.booking_events enable row level security;
alter table public.booking_events force row level security;

create policy booking_events_select_admin_only
  on public.booking_events for select
  to authenticated
  using (public.is_admin());

grant select on public.booking_events to authenticated;
-- Deliberately no INSERT/UPDATE/DELETE grant to anon or authenticated —
-- writes only ever happen via log_booking_event(), a SECURITY DEFINER
-- function owned by a role that bypasses RLS.


-- =============================================================================
-- 5. BOOKINGS / PAYMENT_RECEIPTS: new columns
-- =============================================================================
-- Assumes a pre-launch, empty bookings/payment_receipts table (this project
-- has not been applied to a live Supabase project yet — see docs). If
-- applying against a populated table, add these nullable first and backfill
-- before adding NOT NULL/FK constraints.

alter table public.bookings
  add column booking_reference        text,
  add column intended_payment_method  text references public.payment_methods (code),
  add column notification_status      text not null default 'not_sent',
  add column notification_sent_at     timestamptz,
  add column notification_error       text;

alter table public.bookings
  add constraint bookings_booking_reference_key unique (booking_reference),
  add constraint bookings_notification_status_check
    check (notification_status in ('not_sent', 'queued', 'sent', 'failed'));

comment on column public.bookings.booking_reference is
  'Human-facing reference, e.g. WTN-20260804-000001. Set by confirm_booking() via generate_booking_reference(); never client-supplied.';
comment on column public.bookings.intended_payment_method is
  'What the customer said they''d pay with at booking time. May differ from payment_receipts.payment_method if they change their mind before uploading.';
comment on column public.bookings.notification_status is
  'Placeholder for future WhatsApp/SMS integration. Not wired to any real notification sender yet.';

alter table public.payment_receipts
  add column payment_method text not null references public.payment_methods (code);

comment on column public.payment_receipts.payment_method is
  'The channel this specific receipt corresponds to (set by upload_receipt_metadata()).';


-- =============================================================================
-- 6. WORKING-HOURS / SETTINGS HELPER FUNCTIONS
-- =============================================================================

create or replace function public.get_working_hours()
returns table (open_hour integer, close_hour integer, tz_offset_hours integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
begin
  select value into v from public.settings where key = 'working_hours';
  open_hour := coalesce((v ->> 'open_hour')::integer, 14);
  close_hour := coalesce((v ->> 'close_hour')::integer, 4);
  tz_offset_hours := coalesce((v ->> 'timezone_offset_hours')::integer, 2);
  return next;
end;
$$;

comment on function public.get_working_hours() is
  'Reads settings.working_hours, falling back to 14:00-04:00 / UTC+2 if unset. Named-timezone conversion is deliberately avoided (see docs) in favour of a fixed offset.';

create or replace function public.get_lock_duration_minutes()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select value::text::integer from public.settings where key = 'lock_duration_minutes'),
    5
  );
$$;

create or replace function public.compute_window_for_date(p_date date)
returns table (window_start timestamptz, window_end timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_open integer;
  v_close integer;
  v_offset integer;
begin
  select open_hour, close_hour, tz_offset_hours
    into v_open, v_close, v_offset
    from public.get_working_hours();

  window_start := (p_date::timestamp + make_interval(hours => v_open)) - make_interval(hours => v_offset);
  window_end := ((p_date + 1)::timestamp + make_interval(hours => v_close)) - make_interval(hours => v_offset);
  return next;
end;
$$;

comment on function public.compute_window_for_date(date) is
  'Given an operating day, returns the UTC-instant boundaries of its 14:00->04:00(+1) session, per current settings.';

create or replace function public.compute_session_window(p_starts_at timestamptz)
returns table (booking_date date, window_start timestamptz, window_end timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_open integer;
  v_close integer;
  v_offset integer;
  v_local timestamptz;
  v_date date;
begin
  select open_hour, close_hour, tz_offset_hours
    into v_open, v_close, v_offset
    from public.get_working_hours();

  v_local := p_starts_at + make_interval(hours => v_offset);

  if extract(hour from v_local) < v_open then
    v_date := (v_local - interval '1 day')::date;
  else
    v_date := v_local::date;
  end if;

  booking_date := v_date;
  select w.window_start, w.window_end into window_start, window_end
    from public.compute_window_for_date(v_date) w;
  return next;
end;
$$;

comment on function public.compute_session_window(timestamptz) is
  'Given an instant, determines which operating day''s session it belongs to (rolling back before the daily open_hour) and that session''s window boundaries.';


-- =============================================================================
-- 7. bookings_set_derived_fields — REPLACED to use settings-driven hours
-- =============================================================================

create or replace function public.bookings_set_derived_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_price          integer;
  v_section_active boolean;
  v_section_branch uuid;
  v_window         record;
begin
  if tg_op = 'INSERT' then
    new.status := 'pending';
  end if;

  select price_egp, is_active, branch_id
    into v_price, v_section_active, v_section_branch
    from public.field_sections
   where id = new.field_section_id;

  if not found then
    raise exception 'field_section_id % does not exist', new.field_section_id
      using errcode = '23503';
  end if;

  if not v_section_active then
    raise exception 'This field section is not currently bookable' using errcode = '23514';
  end if;

  if new.branch_id is distinct from v_section_branch then
    raise exception 'branch_id does not match the branch of field_section_id'
      using errcode = '23514';
  end if;

  new.total_price_egp := v_price;

  select * into v_window from public.compute_session_window(new.starts_at);
  new.booking_date := v_window.booking_date;

  if new.starts_at < v_window.window_start or new.ends_at > v_window.window_end then
    raise exception
      'Booking must fall within operating hours. Requested % -> %',
      new.starts_at, new.ends_at
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.bookings_set_derived_fields() is
  'Derives booking_date, recomputes total_price_egp server-side, forces status=pending on insert, enforces the settings-driven operating window. (Phase 3: window logic now reads settings.working_hours instead of hardcoded 14/4.)';


-- =============================================================================
-- 8. booking_locks: working-hours validation trigger (new)
-- =============================================================================

create or replace function public.booking_locks_validate_window()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window record;
begin
  select * into v_window from public.compute_session_window(new.starts_at);

  if new.starts_at < v_window.window_start or new.ends_at > v_window.window_end then
    raise exception
      'Lock must fall within operating hours. Requested % -> %',
      new.starts_at, new.ends_at
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger booking_locks_validate_window
  before insert on public.booking_locks
  for each row execute function public.booking_locks_validate_window();


-- =============================================================================
-- 9. AUDIT LOGGING: log_booking_event() + automatic triggers
-- =============================================================================

create or replace function public.log_booking_event(
  p_booking_id uuid,
  p_lock_id    uuid,
  p_event_type text,
  p_metadata   jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.booking_events (booking_id, lock_id, event_type, metadata)
  values (p_booking_id, p_lock_id, p_event_type, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.log_booking_event(uuid, uuid, text, jsonb) is
  'Central write path for booking_events. Called by RPCs and by the automatic triggers below — application code should never INSERT booking_events directly.';

-- BOOKING_CREATED, automatically, whenever a bookings row is inserted
-- (regardless of which code path created it).
create or replace function public.bookings_log_created_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_booking_event(
    new.id, null, 'BOOKING_CREATED',
    jsonb_build_object('field_section_id', new.field_section_id, 'branch_id', new.branch_id)
  );
  return new;
end;
$$;

create trigger bookings_log_created_event
  after insert on public.bookings
  for each row execute function public.bookings_log_created_event();

-- Status-transition events, automatically, whenever bookings.status changes
-- (covers both the future admin dashboard and any other code path).
create or replace function public.bookings_log_status_change_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event text;
begin
  if new.status is distinct from old.status then
    v_event := case new.status
      when 'confirmed' then 'BOOKING_CONFIRMED'
      when 'cancelled' then 'BOOKING_CANCELLED'
      when 'completed' then 'BOOKING_COMPLETED'
      when 'no_show'   then 'BOOKING_NO_SHOW'
      else null
    end;

    if v_event is not null then
      perform public.log_booking_event(
        new.id, null, v_event,
        jsonb_build_object('old_status', old.status, 'new_status', new.status)
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger bookings_log_status_change_event
  after update of status on public.bookings
  for each row execute function public.bookings_log_status_change_event();

-- PAYMENT_UPLOADED, automatically, whenever a receipt is inserted.
create or replace function public.payment_receipts_log_uploaded_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_booking_event(
    new.booking_id, null, 'PAYMENT_UPLOADED',
    jsonb_build_object('receipt_id', new.id, 'payment_method', new.payment_method)
  );
  return new;
end;
$$;

create trigger payment_receipts_log_uploaded_event
  after insert on public.payment_receipts
  for each row execute function public.payment_receipts_log_uploaded_event();


-- =============================================================================
-- 10. booking_locks_prevent_conflicts — REPLACED to add is_active check +
--     LOCK_EXPIRED event logging for swept rows
-- =============================================================================

create or replace function public.booking_locks_prevent_conflicts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conflicts_with  text[];
  v_section_branch  uuid;
  v_section_active  boolean;
  v_during          tstzrange;
  v_conflict_id     uuid;
  v_expired         record;
begin
  -- Sweep expired locks first (so overlap checks below only ever see live
  -- rows), logging a LOCK_EXPIRED event for each one removed this way.
  for v_expired in
    delete from public.booking_locks where expires_at <= now()
    returning id, field_section_id, session_id
  loop
    perform public.log_booking_event(
      null, v_expired.id, 'LOCK_EXPIRED',
      jsonb_build_object('field_section_id', v_expired.field_section_id, 'session_id', v_expired.session_id, 'reason', 'swept_on_insert')
    );
  end loop;

  select conflicts_with, branch_id, is_active
    into v_conflicts_with, v_section_branch, v_section_active
    from public.field_sections
   where id = new.field_section_id;

  if not found then
    raise exception 'field_section_id % does not exist', new.field_section_id
      using errcode = '23503';
  end if;

  if not v_section_active then
    raise exception 'This field section is not currently bookable' using errcode = '23514';
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
  'Phase 3: now also checks field_sections.is_active, and logs a LOCK_EXPIRED event for every stale lock it sweeps.';


-- =============================================================================
-- 11. BOOKING REFERENCE GENERATION
-- =============================================================================

create or replace function public.generate_booking_reference()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offset integer;
  v_date   date;
  v_seq    integer;
begin
  select tz_offset_hours into v_offset from public.get_working_hours();
  v_date := (now() + make_interval(hours => v_offset))::date;

  insert into public.booking_reference_counters (ref_date, last_seq)
  values (v_date, 1)
  on conflict (ref_date) do update set last_seq = public.booking_reference_counters.last_seq + 1
  returning last_seq into v_seq;

  return 'WTN-' || to_char(v_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

comment on function public.generate_booking_reference() is
  'Atomically issues the next sequential reference for today (Cairo-local), e.g. WTN-20260804-000001. Race-safe via INSERT ... ON CONFLICT DO UPDATE.';


-- =============================================================================
-- 12. RPC 1 — create_booking_lock()
-- =============================================================================

create or replace function public.create_booking_lock(
  p_field_section_id uuid,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz,
  p_session_id       text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lock_id      uuid;
  v_expires_at   timestamptz;
  v_lock_minutes integer;
begin
  if p_session_id is null or btrim(p_session_id) = '' then
    raise exception 'session_id is required' using errcode = '22023';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'ends_at must be after starts_at' using errcode = '22023';
  end if;

  v_lock_minutes := public.get_lock_duration_minutes();

  -- Section-exists/active, working-hours, and conflict validation (against
  -- bookings/closed_slots/other live locks) all happen inside the
  -- booking_locks_validate_window and booking_locks_prevent_conflicts
  -- triggers — not duplicated here.
  insert into public.booking_locks (field_section_id, session_id, starts_at, ends_at, expires_at)
  values (p_field_section_id, p_session_id, p_starts_at, p_ends_at, now() + make_interval(mins => v_lock_minutes))
  returning id, expires_at into v_lock_id, v_expires_at;

  perform public.log_booking_event(
    null, v_lock_id, 'LOCK_CREATED',
    jsonb_build_object('field_section_id', p_field_section_id, 'session_id', p_session_id,
                        'starts_at', p_starts_at, 'ends_at', p_ends_at)
  );

  return jsonb_build_object(
    'lock_id', v_lock_id,
    'expires_at', v_expires_at,
    'countdown_seconds', greatest(0, extract(epoch from (v_expires_at - now()))::integer)
  );
end;
$$;

comment on function public.create_booking_lock(uuid, timestamptz, timestamptz, text) is
  'Places a temporary hold on a field section + time range. Raises a clear error (exclusion_violation, 23P01) if the slot is already booked or held.';


-- =============================================================================
-- 13. RPC 2 — release_booking_lock()
-- =============================================================================

create or replace function public.release_booking_lock(
  p_lock_id    uuid,
  p_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted_id uuid;
begin
  delete from public.booking_locks
   where id = p_lock_id
     and session_id = p_session_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Lock not found, already released, or does not belong to this session'
      using errcode = 'P0002';
  end if;

  perform public.log_booking_event(null, v_deleted_id, 'LOCK_RELEASED', jsonb_build_object('session_id', p_session_id));

  return jsonb_build_object('released', true, 'lock_id', v_deleted_id);
end;
$$;

comment on function public.release_booking_lock(uuid, text) is
  'Deletes ONLY a lock matching both id and session_id — a session can never release another session''s lock.';


-- =============================================================================
-- 14. RPC 3 — confirm_booking()   (the heart of the system)
-- =============================================================================

create or replace function public.confirm_booking(
  p_lock_id                  uuid,
  p_session_id                text,
  p_customer_name              text,
  p_customer_phone             text,
  p_intended_payment_method    text default null,
  p_notes                       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lock         record;
  v_booking_id   uuid;
  v_reference    text;
  v_price        integer;
  v_status       text;
  v_access_token uuid;
  v_attempt      integer := 0;
begin
  if p_session_id is null or btrim(p_session_id) = '' then
    raise exception 'session_id is required' using errcode = '22023';
  end if;
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'customer_name is required' using errcode = '22023';
  end if;

  if p_intended_payment_method is not null and not exists (
    select 1 from public.payment_methods where code = p_intended_payment_method and is_active
  ) then
    raise exception 'Unsupported or inactive payment method: %', p_intended_payment_method
      using errcode = '22023';
  end if;

  -- Row-lock the lock itself: two concurrent confirm attempts on the exact
  -- same lock_id can't both proceed.
  select * into v_lock
    from public.booking_locks
   where id = p_lock_id
     and session_id = p_session_id
     for update;

  if not found then
    raise exception 'Lock not found, already used, or does not belong to this session'
      using errcode = 'P0002';
  end if;

  -- Branch-scoped serialization, matching the same pattern used by the
  -- bookings/booking_locks conflict triggers, so this whole confirm
  -- operation can't race with a concurrent lock/booking attempt on the
  -- same branch.
  perform pg_advisory_xact_lock(hashtextextended(v_lock.branch_id::text, 0));

  if v_lock.expires_at <= now() then
    -- Deliberately NOT deleting/logging here: this whole function call is
    -- about to raise, which would roll back any write made in this same
    -- transaction (confirmed by testing — an earlier version tried to
    -- delete+log here and the event silently never persisted). The row
    -- is left in place; it's already inert (expires_at <= now() is
    -- excluded everywhere conflicts are checked) and will be cleaned up
    -- and logged as LOCK_EXPIRED by the sweep in
    -- booking_locks_prevent_conflicts the next time any lock is created.
    raise exception 'This hold has expired. Please select the time slot again.'
      using errcode = 'P0002';
  end if;

  delete from public.booking_locks where id = v_lock.id;

  -- Extremely defensive retry: generate_booking_reference() is already
  -- atomic and effectively collision-proof, this loop only exists to
  -- absorb a theoretical unique_violation rather than fail the whole
  -- booking outright.
  loop
    v_attempt := v_attempt + 1;
    v_reference := public.generate_booking_reference();

    begin
      insert into public.bookings (
        branch_id, field_section_id, customer_name, customer_phone,
        starts_at, ends_at, notes, booking_reference, intended_payment_method
      ) values (
        v_lock.branch_id, v_lock.field_section_id, p_customer_name, p_customer_phone,
        v_lock.starts_at, v_lock.ends_at, p_notes, v_reference, p_intended_payment_method
      )
      returning id, total_price_egp, status, access_token
        into v_booking_id, v_price, v_status, v_access_token;

      exit;
    exception when unique_violation then
      if v_attempt >= 3 then
        raise;
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'booking_reference', v_reference,
    'access_token', v_access_token,
    'price', v_price,
    'status', v_status
  );
end;
$$;

comment on function public.confirm_booking(uuid, text, text, text, text, text) is
  'Converts a live lock into a real (status=pending) booking, atomically: verifies + row-locks the caller''s own lock, checks expiry, deletes it, generates a unique reference, inserts the booking. Any conflict/validation failure rolls back the whole operation, including the lock deletion. Does NOT set status to confirmed — that remains a separate admin action after payment review (see docs).';


-- =============================================================================
-- 15. RPC 4 — upload_receipt_metadata()
-- =============================================================================

create or replace function public.upload_receipt_metadata(
  p_booking_id      uuid,
  p_access_token    uuid,
  p_storage_path    text,
  p_payment_method  text,
  p_mime_type       text,
  p_file_size_bytes integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt_id uuid;
begin
  if not public.booking_access_token_matches(p_booking_id, p_access_token) then
    raise exception 'Invalid access token for this booking' using errcode = '42501';
  end if;

  if p_payment_method is null or not exists (
    select 1 from public.payment_methods where code = p_payment_method and is_active
  ) then
    raise exception 'Unsupported or inactive payment method: %', p_payment_method
      using errcode = '22023';
  end if;

  if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 10 * 1024 * 1024 then
    raise exception 'File size must be between 1 byte and 10 MB' using errcode = '22023';
  end if;

  if p_mime_type is null or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    raise exception 'Unsupported file type: %', p_mime_type using errcode = '22023';
  end if;

  if p_storage_path is null or btrim(p_storage_path) = '' then
    raise exception 'storage_path is required' using errcode = '22023';
  end if;

  begin
    insert into public.payment_receipts (
      booking_id, access_token, storage_path, payment_method, mime_type, file_size_bytes
    ) values (
      p_booking_id, p_access_token, p_storage_path, p_payment_method, p_mime_type, p_file_size_bytes
    )
    returning id into v_receipt_id;
  exception when unique_violation then
    raise exception 'A payment receipt has already been submitted for this booking and is awaiting review'
      using errcode = '23505';
  end;

  return jsonb_build_object('receipt_id', v_receipt_id, 'review_status', 'pending');
end;
$$;

comment on function public.upload_receipt_metadata(uuid, uuid, text, text, text, integer) is
  'Validates access_token, payment_method, mime_type, and file size, then records receipt metadata (never the binary itself — that lives in Supabase Storage). PAYMENT_UPLOADED event is logged automatically by a trigger on payment_receipts.';


-- =============================================================================
-- 16. RPC 5 — get_available_slots()
-- =============================================================================

create or replace function public.get_available_slots(
  p_field_section_id uuid,
  p_date             date default current_date
)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_conflicts_with text[];
  v_branch_id      uuid;
  v_window         record;
  v_granularity    integer;
  v_step           interval;
begin
  select conflicts_with, branch_id
    into v_conflicts_with, v_branch_id
    from public.field_sections
   where id = p_field_section_id and is_active;

  if not found then
    raise exception 'field_section_id % does not exist or is not active', p_field_section_id
      using errcode = '23503';
  end if;

  select * into v_window from public.compute_window_for_date(p_date);

  v_granularity := coalesce(
    (select value::text::integer from public.settings where key = 'slot_granularity_minutes'),
    60
  );
  v_step := make_interval(mins => v_granularity);

  return query
    select gs.candidate_start, gs.candidate_start + v_step
      from generate_series(v_window.window_start, v_window.window_end - v_step, v_step) as gs(candidate_start)
     where not exists (
       select 1
         from public.unavailable_slots u
         left join public.field_sections fs on fs.id = u.field_section_id
        where u.branch_id = v_branch_id
          -- NULL field_section_id = branch-wide closure; otherwise only a
          -- section whose code is in this section's conflicts_with array
          -- (covers same-section AND the A/B <-> AB cross-conflict).
          and (u.field_section_id is null or fs.code = any (v_conflicts_with))
          and tstzrange(u.starts_at, u.ends_at, '[)') && tstzrange(gs.candidate_start, gs.candidate_start + v_step, '[)')
     )
     order by gs.candidate_start;
end;
$$;

comment on function public.get_available_slots(uuid, date) is
  'Generates candidate slot_granularity_minutes-wide slots across the operating window for the given day and section, excluding anything overlapping a booking/lock/closure on this section OR a physically conflicting section (per conflicts_with). The frontend must call this rather than computing availability itself.';


-- =============================================================================
-- 17. SECURITY HARDENING — lock down the function-level RPC surface
-- =============================================================================
-- Postgres grants EXECUTE on new functions to PUBLIC by default, and every
-- PUBLIC-executable function in an exposed schema is a potential PostgREST
-- RPC endpoint. Revoke everything, then explicitly re-grant only:
--   (a) the 5 intended public RPCs, and
--   (b) is_admin(), which RLS policies evaluate under the *querying* role's
--       own privileges and therefore must remain callable by anon/authenticated.
-- Trigger functions and internal helpers (compute_session_window,
-- log_booking_event, generate_booking_reference, booking_access_token_matches,
-- etc.) need no such grant: they only ever run inside another SECURITY
-- DEFINER function's context or as part of trigger firing, both of which
-- execute as the function/table owner regardless of PUBLIC's EXECUTE grants.

revoke execute on all functions in schema public from public;

grant execute on function public.is_admin() to anon, authenticated;

grant execute on function public.create_booking_lock(uuid, timestamptz, timestamptz, text) to anon, authenticated;
grant execute on function public.release_booking_lock(uuid, text) to anon, authenticated;
grant execute on function public.confirm_booking(uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function public.upload_receipt_metadata(uuid, uuid, text, text, text, integer) to anon, authenticated;
grant execute on function public.get_available_slots(uuid, date) to anon, authenticated;


-- =============================================================================
-- 18. TIGHTEN RLS — remove Phase 2's direct-INSERT escape hatches
-- =============================================================================
-- Phase 2 allowed anon to INSERT bookings/booking_locks/payment_receipts
-- directly via RLS, as a stopgap before this RPC layer existed. Phase 3
-- requires "No direct booking INSERTs from the frontend" — all writes now
-- go through the SECURITY DEFINER RPCs above, which bypass RLS entirely
-- via their owner's privileges. Remove the now-obsolete policies and grants
-- so the RPCs are the *only* path, not merely the *recommended* one.

drop policy if exists bookings_insert_public on public.bookings;
drop policy if exists booking_locks_insert_public on public.booking_locks;
drop policy if exists payment_receipts_insert_public on public.payment_receipts;

revoke insert on public.bookings from anon, authenticated;
revoke insert on public.booking_locks from anon, authenticated;
revoke insert on public.payment_receipts from anon, authenticated;
