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
