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
