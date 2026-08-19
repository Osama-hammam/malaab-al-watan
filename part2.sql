

-- =============================================================================
-- ملعب الوطن (Malaab Al Watan) — Football Field Booking System
-- Phase 4.2: Admin Dashboard — read RPCs
-- =============================================================================
-- Additive to Phase 2/3/4. No schema changes to existing tables — admins
-- already have full RLS-granted access to bookings/payment_receipts/
-- closed_slots/settings (Phase 2 admin policies), so most of the dashboard
-- (bookings list, receipt review, settings edit) is implemented as plain
-- table reads/updates in the TS service layer, no new RPC needed.
--
-- These 3 RPCs exist only where real server-side computation is required
-- (schedule generation reusing the exact same conflict semantics as
-- bookings_prevent_cross_section_conflicts, and aggregate stats) — not as
-- a substitute for RLS. Each explicitly checks is_admin() itself (defense
-- in depth) in addition to being grant-restricted to `authenticated` only
-- (never `anon`), consistent with Phase 3's hardening posture.
-- =============================================================================


-- =============================================================================
-- 1. get_admin_overview_stats()
-- =============================================================================

create or replace function public.get_admin_overview_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_today   date;
  v_result  jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  -- Reuses the exact same operating-day logic as booking_date itself
  -- (rolls back to the previous day before the daily open_hour) rather
  -- than a naive "current Cairo calendar date" calculation, which would
  -- show the wrong day during the after-midnight portion of a session —
  -- caught by testing, see docs/BUSINESS_LOGIC.md.
  select booking_date into v_today from public.compute_session_window(now());

  select jsonb_build_object(
    'todays_bookings', (
      select count(*) from public.bookings
       where booking_date = v_today and status in ('pending', 'confirmed', 'completed')
    ),
    'todays_revenue', (
      select coalesce(sum(total_price_egp), 0) from public.bookings
       where booking_date = v_today and status in ('pending', 'confirmed', 'completed')
    ),
    'total_bookings', (select count(*) from public.bookings),
    'pending_receipts', (select count(*) from public.payment_receipts where review_status = 'pending'),
    'confirmed_bookings', (select count(*) from public.bookings where status = 'confirmed'),
    'cancelled_bookings', (select count(*) from public.bookings where status = 'cancelled')
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_admin_overview_stats() is
  'Dashboard overview counts/revenue for "today" (Cairo-local operating day). Admin-only.';


-- =============================================================================
-- 2. get_admin_schedule(branch_id, date)
-- =============================================================================
-- Full A/B/AB status grid for one branch/day, reusing the exact same
-- cross-section conflict semantics as bookings_prevent_cross_section_conflicts
-- (conflicts_with) — the authority on conflicts stays entirely server-side,
-- never re-derived in the dashboard UI.

create or replace function public.get_admin_schedule(p_branch_id uuid, p_date date)
returns table (
  field_section_id uuid,
  code             text,
  slot_start       timestamptz,
  slot_end         timestamptz,
  status           text,
  booking_id       uuid,
  booking_reference text,
  customer_name    text,
  customer_phone   text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_window      record;
  v_granularity integer;
  v_step        interval;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into v_window from public.compute_window_for_date(p_date);

  v_granularity := coalesce(
    (select value::text::integer from public.settings where key = 'slot_granularity_minutes'),
    60
  );
  v_step := make_interval(mins => v_granularity);

  return query
    select
      fs.id,
      fs.code,
      gs.slot_start,
      gs.slot_start + v_step as slot_end,
      case
        when bk.id is not null then 'booked'
        when lk.id is not null then 'locked'
        when cs.id is not null then 'closed'
        else 'available'
      end as status,
      bk.id,
      bk.booking_reference,
      bk.customer_name,
      bk.customer_phone
    from public.field_sections fs
    cross join lateral generate_series(v_window.window_start, v_window.window_end - v_step, v_step) as gs (slot_start)
    left join lateral (
      select b.id, b.booking_reference, b.customer_name, b.customer_phone
        from public.bookings b
        join public.field_sections fsb on fsb.id = b.field_section_id
       where fsb.branch_id = p_branch_id
         and fsb.code = any (fs.conflicts_with)
         and b.status in ('pending', 'confirmed')
         and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(gs.slot_start, gs.slot_start + v_step, '[)')
       limit 1
    ) bk on true
    left join lateral (
      select bl.id
        from public.booking_locks bl
        join public.field_sections fsl on fsl.id = bl.field_section_id
       where fsl.branch_id = p_branch_id
         and fsl.code = any (fs.conflicts_with)
         and bl.expires_at > now()
         and tstzrange(bl.starts_at, bl.ends_at, '[)') && tstzrange(gs.slot_start, gs.slot_start + v_step, '[)')
       limit 1
    ) lk on true
    left join lateral (
      select c.id
        from public.closed_slots c
        left join public.field_sections fsc on fsc.id = c.field_section_id
       where c.branch_id = p_branch_id
         and (c.field_section_id is null or fsc.code = any (fs.conflicts_with))
         and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(gs.slot_start, gs.slot_start + v_step, '[)')
       limit 1
    ) cs on true
   where fs.branch_id = p_branch_id
     and fs.is_active
   order by fs.code, gs.slot_start;
end;
$$;

comment on function public.get_admin_schedule(uuid, date) is
  'Full A/B/AB schedule grid for one branch/day (available/locked/booked/closed), including booking details where occupied. Admin-only. Reuses the same conflicts_with cross-section logic as the booking-conflict triggers — never re-implemented in the frontend.';


-- =============================================================================
-- 3. get_admin_revenue_report(from_date, to_date, branch_id?)
-- =============================================================================

create or replace function public.get_admin_revenue_report(
  p_from_date date,
  p_to_date   date,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_offset integer;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_to_date < p_from_date then
    raise exception 'p_to_date must not be before p_from_date' using errcode = '22023';
  end if;

  select tz_offset_hours into v_offset from public.get_working_hours();

  select jsonb_build_object(
    'from_date', p_from_date,
    'to_date', p_to_date,
    'total_revenue', coalesce((
      select sum(b.total_price_egp) from public.bookings b
       where b.booking_date between p_from_date and p_to_date
         and b.status in ('pending', 'confirmed', 'completed')
         and (p_branch_id is null or b.branch_id = p_branch_id)
    ), 0),
    'total_bookings', (
      select count(*) from public.bookings b
       where b.booking_date between p_from_date and p_to_date
         and b.status in ('pending', 'confirmed', 'completed')
         and (p_branch_id is null or b.branch_id = p_branch_id)
    ),
    'by_branch', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select br.id as branch_id, br.name as branch_name,
               coalesce(sum(b.total_price_egp), 0) as revenue,
               count(*) as bookings_count
          from public.bookings b
          join public.branches br on br.id = b.branch_id
         where b.booking_date between p_from_date and p_to_date
           and b.status in ('pending', 'confirmed', 'completed')
           and (p_branch_id is null or b.branch_id = p_branch_id)
         group by br.id, br.name
         order by revenue desc
      ) t
    ),
    'by_field_type', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select fs.field_type,
               coalesce(sum(b.total_price_egp), 0) as revenue,
               count(*) as bookings_count
          from public.bookings b
          join public.field_sections fs on fs.id = b.field_section_id
         where b.booking_date between p_from_date and p_to_date
           and b.status in ('pending', 'confirmed', 'completed')
           and (p_branch_id is null or b.branch_id = p_branch_id)
         group by fs.field_type
         order by revenue desc
      ) t
    ),
    'popular_hours', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select extract(hour from b.starts_at + make_interval(hours => v_offset))::int as hour,
               count(*) as bookings_count
          from public.bookings b
         where b.booking_date between p_from_date and p_to_date
           and b.status in ('pending', 'confirmed', 'completed')
           and (p_branch_id is null or b.branch_id = p_branch_id)
         group by 1
         order by bookings_count desc, hour asc
         limit 10
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_admin_revenue_report(date, date, uuid) is
  'Revenue + booking-count breakdown (total, by branch, by field type) and most-booked hours for a date range. Admin-only.';


-- =============================================================================
-- 4. Security hardening (same posture as Phase 3 §17): these are new
--    functions, so Postgres's default PUBLIC EXECUTE grant applies to them
--    too — Phase 3's one-time revoke did not retroactively cover functions
--    created later. Lock them down the same way: no anon access at all,
--    authenticated only (the is_admin() check inside each function is the
--    real gate; this grant is the outer one).
-- =============================================================================

revoke execute on function public.get_admin_overview_stats() from public;
revoke execute on function public.get_admin_schedule(uuid, date) from public;
revoke execute on function public.get_admin_revenue_report(date, date, uuid) from public;

grant execute on function public.get_admin_overview_stats() to authenticated;
grant execute on function public.get_admin_schedule(uuid, date) to authenticated;
grant execute on function public.get_admin_revenue_report(date, date, uuid) to authenticated;


-- -----------------------------------------------------

-- =============================================================================
-- ملعب الوطن (Malaab Al Watan) — Football Field Booking System
-- Phase 4.3: Closed Slots management + Storage security hardening
-- =============================================================================
-- Two independent, additive changes:
--
--   1. closed_slots: no new RPC. Reviewed the existing
--      closed_slots_admin_all RLS policy (Phase 2) — `for all to
--      authenticated using(is_admin()) with check(is_admin())` — plus the
--      existing closed_slots_time_order_check constraint and the
--      closed_slots_validate_section_branch trigger. Together these
--      already fully cover "only admins can create/delete, time range
--      must be valid, section must belong to the branch". No RPC is
--      needed; a new SECURITY DEFINER function here would duplicate
--      protection RLS+constraints already provide, not add any. The one
--      real gap: created_by was a plain nullable column with no server-
--      side default, so a client could omit it or (more importantly) it
--      wasn't reliably populated at all. Fixed with a DEFAULT, not a
--      trigger/RPC — the simplest correct fix.
--
--   2. Storage: the Phase 4 bucket had no bucket-level file_size_limit /
--      allowed_mime_types (Supabase Storage enforces these BEFORE any RLS
--      policy or application code runs, at the storage-api layer — a
--      meaningfully stronger guarantee than only checking client-side and
--      inside upload_receipt_metadata's metadata row, since a crafted
--      request could otherwise upload an oversized/wrong-type file
--      directly to Storage bypassing both). Also tightens the INSERT
--      policy: previously any path under receipts/ was accepted; now the
--      second path segment must be a UUID that matches an existing
--      booking (via a new SECURITY DEFINER helper, same pattern as
--      booking_access_token_matches). This does NOT verify access_token
--      ownership at the storage layer — that still requires a custom Edge
--      Function fronting uploads to be fully rigorous, which remains out
--      of scope (documented in docs/ADMIN_DASHBOARD.md and the Phase 4
--      migration). What it does close off: uploading junk to a
--      completely made-up/nonexistent path.
--
-- IMPORTANT — see docs/ADMIN_DASHBOARD.md "Storage: what still needs
-- testing against a real Supabase project": the bucket-level
-- file_size_limit/allowed_mime_types enforcement happens in Supabase's
-- storage-api service, which is NOT part of Postgres and therefore
-- cannot be exercised by this project's local Postgres-only test setup.
-- The SQL below has been applied and its *policies* tested locally; the
-- bucket-level limits themselves have not been (and cannot be) verified
-- outside a real Supabase project.
-- =============================================================================


-- =============================================================================
-- 1. closed_slots: server-derived created_by
-- =============================================================================

alter table public.closed_slots
  alter column created_by set default auth.uid();

comment on column public.closed_slots.created_by is
  'Defaults to auth.uid() — always the admin who actually made the request, never client-supplied.';


-- =============================================================================
-- 2. Storage bucket-level limits
-- =============================================================================

update storage.buckets
   set file_size_limit = 10485760, -- 10 MB, matching payment_receipts_file_size_check
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
 where id = 'payment-screenshots';


-- =============================================================================
-- 3. Tightened upload path validation
-- =============================================================================

create or replace function public.is_valid_receipt_upload_path(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_parts       text[];
  v_booking_id  uuid;
begin
  v_parts := storage.foldername(p_name);

  if v_parts is null or array_length(v_parts, 1) is distinct from 2 then
    return false;
  end if;

  if v_parts[1] is distinct from 'receipts' then
    return false;
  end if;

  -- Regex check before casting, so a malformed segment returns false
  -- instead of raising an uncaught cast-error inside an RLS check.
  if v_parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_booking_id := v_parts[2]::uuid;

  return exists (select 1 from public.bookings where id = v_booking_id);
end;
$$;

comment on function public.is_valid_receipt_upload_path(text) is
  'True if the upload path is shaped receipts/<existing-booking-id>/<filename>. Does NOT verify access_token ownership (see migration header) — only that the path is not entirely made up.';

drop policy if exists payment_screenshots_insert_public on storage.objects;

create policy payment_screenshots_insert_public
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'payment-screenshots'
    and public.is_valid_receipt_upload_path(name)
  );

revoke execute on function public.is_valid_receipt_upload_path(text) from public;
grant execute on function public.is_valid_receipt_upload_path(text) to anon, authenticated;


-- -----------------------------------------------------

-- =============================================================================
-- ملعب الوطن (Malaab Al Watan) — Football Field Booking System
-- Phase 5: Realtime enablement
-- =============================================================================
-- Adds bookings, booking_locks, closed_slots, and payment_receipts to
-- Supabase's `supabase_realtime` publication, so the admin dashboard can
-- subscribe to postgres_changes and refetch (never re-derive
-- availability/conflict logic client-side — see
-- src/hooks/useRealtimeInvalidate.ts).
--
-- Deliberately NOT added for anon/customer use: Realtime's postgres_changes
-- respects each table's RLS for the subscribing role's JWT. Since anon has
-- no SELECT policy on bookings/booking_locks/closed_slots (by design, to
-- protect customer PII — see docs/DATABASE.md), an anon subscription to
-- these tables would simply never receive any events; there is nothing to
-- gain by adding them for that purpose. The customer-facing slot grid
-- instead uses short-interval polling through the existing
-- get_available_slots RPC (see docs/BUSINESS_LOGIC.md) — the RPC remains
-- the sole authority on availability either way.
--
-- Guarded with existence checks so this migration is a safe no-op against
-- a local/non-Supabase Postgres instance that has no `supabase_realtime`
-- publication (as used by this project's local test suite), and so it is
-- idempotent (safe to re-run) against a real Supabase project.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
    ) then
      alter publication supabase_realtime add table public.bookings;
    end if;

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'booking_locks'
    ) then
      alter publication supabase_realtime add table public.booking_locks;
    end if;

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'closed_slots'
    ) then
      alter publication supabase_realtime add table public.closed_slots;
    end if;

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payment_receipts'
    ) then
      alter publication supabase_realtime add table public.payment_receipts;
    end if;

  end if;
end;
$$;


