-- =============================================================================
-- ملعب الوطن (Malaab Al Watan) — Football Field Booking System
-- Phase 4: Storage setup for payment receipt screenshots
-- =============================================================================
-- Minimal, additive to Phase 2/3. Creates the private bucket
-- payment-screenshots (matching VITE_SUPABASE_PAYMENTS_BUCKET, set since
-- Phase 1) and RLS on storage.objects so:
--   - anon can INSERT (upload) but never SELECT/UPDATE/DELETE — uploads are
--     write-only from the client, matching payment_receipts' own privacy
--     model (the metadata row, not the file, is what upload_receipt_metadata
--     validates via access_token).
--   - admins (is_admin()) can read/manage everything, for the dashboard
--     (Phase 5+) to review receipts.
--
-- Full capability-token verification at the storage layer (matching a
-- receipt file to the exact access_token used for its metadata row) would
-- require a custom Edge Function fronting uploads; out of scope for this
-- milestone — see docs/BUSINESS_LOGIC.md recommendations. The
-- upload_receipt_metadata RPC already enforces the access_token check on
-- the authoritative metadata row.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('payment-screenshots', 'payment-screenshots', false)
on conflict (id) do nothing;

create policy payment_screenshots_insert_public
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'payment-screenshots'
    and (storage.foldername(name))[1] = 'receipts'
  );

create policy payment_screenshots_select_admin_only
  on storage.objects for select
  to authenticated
  using (bucket_id = 'payment-screenshots' and public.is_admin());

create policy payment_screenshots_admin_write
  on storage.objects for update
  to authenticated
  using (bucket_id = 'payment-screenshots' and public.is_admin())
  with check (bucket_id = 'payment-screenshots' and public.is_admin());

create policy payment_screenshots_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'payment-screenshots' and public.is_admin());
