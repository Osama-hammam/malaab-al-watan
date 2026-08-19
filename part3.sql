

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
    ('A',  '5v5', 300, array['A', 'AB']),
    ('B',  '5v5', 300, array['B', 'AB']),
    ('AB', '7v7', 600, array['A', 'B', 'AB'])
) as s(code, field_type, price_egp, conflicts_with)
on conflict (branch_id, code) do update
  set price_egp = excluded.price_egp,
      field_type = excluded.field_type,
      conflicts_with = excluded.conflicts_with;

