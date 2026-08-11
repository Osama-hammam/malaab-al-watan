-- =============================================================================
-- ملعب الوطن — Seed data (branches + field sections)
-- =============================================================================
-- Idempotent: safe to run multiple times (e.g. `supabase db reset`).
-- Prices/branches must stay in sync with src/constants/fields.ts on the
-- frontend until that constants file is replaced by a live Supabase query
-- (see docs/DATABASE.md recommendations).

insert into public.branches (slug, name) values
  ('mubarak-al-sabeen', 'فرع مبارك السبعين'),
  ('al-oula', 'فرع الأولى')
on conflict (slug) do update
  set name = excluded.name;

-- A + B always conflict with AB (and themselves); A and B never conflict
-- with each other (independent halves of the same physical field).
insert into public.field_sections (branch_id, code, field_type, price_egp, conflicts_with)
select b.id, s.code, s.field_type, s.price_egp, s.conflicts_with
from public.branches b
cross join (
  values
    ('A',  '6v6', 300, array['A', 'AB']),
    ('B',  '6v6', 300, array['B', 'AB']),
    ('AB', '8v8', 600, array['A', 'B', 'AB'])
) as s(code, field_type, price_egp, conflicts_with)
on conflict (branch_id, code) do update
  set price_egp = excluded.price_egp,
      field_type = excluded.field_type,
      conflicts_with = excluded.conflicts_with;

-- ---------------------------------------------------------------------------
-- Phase 3: settings + payment methods
-- ---------------------------------------------------------------------------

insert into public.settings (key, value, description, is_public) values
  ('brand_name', '"ملعب الوطن"',
    'Official brand name shown across the app.', true),
  ('working_hours', '{"open_hour":14,"close_hour":4,"timezone_offset_hours":2}',
    'Daily operating window (24h clock, Cairo local via fixed UTC+2 offset). close_hour is on the following day.', true),
  ('lock_duration_minutes', '5',
    'How long a booking_locks hold is valid for before auto-expiring.', true),
  ('slot_granularity_minutes', '60',
    'Step size used by get_available_slots() to generate candidate slot start times.', true),
  ('vodafone_cash_number', '"01018349359"',
    'Vodafone Cash number customers should send payment to. REPLACE with the real number before launch.', true),
  ('whatsapp_number', '"01018349359"',
    'WhatsApp number for booking notifications / customer contact. REPLACE with the real number before launch.', true),
  ('branch_visibility_mode', '"active_only"',
    'Reserved for future frontend use; branches.is_active is the current source of truth.', true)
on conflict (key) do update
  set value = excluded.value,
      description = excluded.description,
      is_public = excluded.is_public;

insert into public.payment_methods (code, label_ar, is_active, sort_order) values
  ('vodafone_cash',  'فودافون كاش', true,  1),
  ('instapay',       'إنستاباي',    false, 2),
  ('orange_cash',    'أورنج كاش',   false, 3),
  ('bank_transfer',  'تحويل بنكي',  false, 4)
on conflict (code) do update
  set label_ar = excluded.label_ar,
      sort_order = excluded.sort_order;
