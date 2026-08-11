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
