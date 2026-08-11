# ملعب الوطن — Football Field Booking System

A full-stack football field booking system for **ملعب الوطن** ("Malaab
Al Watan"), spanning two branches:

- ملعب الوطن - فرع مبارك السبعين (Mubarak Al Sab'een branch)
- ملعب الوطن - فرع الأولى (Al Oula branch)

Each branch offers the same three sub-fields: **A** (5v5), **B** (5v5), and
**AB** (7v7, the combined full field).

**Current state:** a complete customer booking flow (branch → field →
slot → lock → checkout → payment receipt upload → success), a complete
Arabic/RTL admin dashboard (overview, bookings management with receipt
review, daily schedule with closure management, revenue reporting,
settings), Realtime updates for the admin dashboard, and 92 passing
backend integration tests against a real Postgres instance. **Not yet
applied to a live Supabase project** — see
[`docs/PRODUCTION_CHECKLIST.md`](docs/PRODUCTION_CHECKLIST.md) for the
complete go-live steps, including what still needs verifying against a
real Supabase project (a few Storage/Realtime behaviors that cannot be
exercised from local Postgres alone — clearly flagged there, not hidden).

WhatsApp notifications and deployment automation are the only explicitly
deferred pieces (columns/hooks exist for the former; not built, per the
project's own instructions to leave them for a later phase).

## Tech stack

| Layer      | Choice                                                      |
| ---------- | ------------------------------------------------------------ |
| Frontend   | React 19 + TypeScript + Vite                                 |
| Styling    | Tailwind CSS v4 (CSS-first config) + shadcn/ui primitives    |
| Routing    | React Router v7                                               |
| Data       | TanStack Query                                                |
| Forms      | React Hook Form + Zod                                         |
| Animation  | Framer Motion                                                 |
| Backend    | Supabase (Postgres + Auth + Storage)                           |

## Project structure

```
src/
  assets/            Static images/icons
  components/
    ui/              shadcn/ui primitives (Button, Card, Badge, Skeleton, Sonner)
    layout/          Navbar, Footer, AppLayout (route shell)
    booking/         Customer booking flow components (Phase 4 Milestone 1)
    dashboard/       Admin dashboard components (Phase 4.2)
    common/          Small shared components (PageContainer, etc.)
  config/
    env.ts           Validated, typed environment variable access
    supabase.ts      Typed Supabase client singleton
  constants/
    fields.ts        Brand name, branches, sub-fields, pricing, working hours
    routes.ts        Central route path constants (public + dashboard)
  context/
    AuthContext.tsx  Supabase Auth session + real is_admin() check (Phase 4.2)
  hooks/
    useBookingFlow.ts, useCountdown.ts, useSlotGrid.ts — customer booking flow
    useRealtimeInvalidate.ts — Realtime→refetch bridge, used by admin pages
  lib/
    utils.ts         cn() class-merging helper (required by shadcn/ui)
    queryClient.ts   TanStack Query client instance
    session.ts       Anonymous per-browser session id (for booking_locks)
  pages/
    Home.tsx         Landing page — shows locations & pricing
    Booking.tsx      Full customer booking wizard (Phase 4 Milestone 1)
    NotFound.tsx     404 page
    dashboard/       Admin pages: Overview, Bookings, Schedule, Revenue, Settings, Login (Phase 4.2)
  router/
    index.tsx        Route tree — public site (AppLayout) + dashboard (AdminGuard + DashboardLayout)
  schemas/
    bookingDetails.schema.ts   Zod validation for the booking details form
  services/
    rpc/             One file per anon-facing Supabase RPC + typed errors
    admin/           Admin-only services (stats, schedule, bookings, receipts, settings)
    settingsService.ts, paymentMethodsService.ts, branchesService.ts,
    availabilityService.ts, receiptStorageService.ts
  types/
    database.types.ts  Hand-written Database type matching the applied migrations
  App.tsx            Providers (QueryClient, AuthProvider, Router)
  main.tsx           React entry point
  index.css          Tailwind v4 entry + design tokens (light/dark theme)
tests/
  rpc/               67 integration tests against a real Postgres instance
supabase/
  migrations/        SQL migrations (schema, business logic, storage, admin dashboard)
  seed.sql           Idempotent seed data
docs/
  DATABASE.md          Phase 2 write-up
  BUSINESS_LOGIC.md     Phase 3 write-up
  ADMIN_DASHBOARD.md    Phase 4.2 write-up
```

## Branches (dynamic by design)

All branch/brand data lives in `src/constants/fields.ts`. A branch is not
hard-coded field-by-field — it's produced by a `createBranch(id, branchName)`
helper that automatically attaches the standard A / B / AB sub-fields, so
adding a new branch is a single line:

```ts
export const LOCATIONS: Location[] = [
  createBranch("mubarak-al-sabeen", "فرع مبارك السبعين"),
  createBranch("al-oula", "فرع الأولى"),
  // Add a new branch here — everything else (Home page cards, pricing,
  // future booking selectors) picks it up automatically:
  createBranch("nasr-city", "فرع مدينة نصر"),
];
```

Every branch's full display name is derived automatically as
`` `${BRAND_NAME} - ${branchName}` `` (e.g. `ملعب الوطن - فرع مبارك السبعين`),
so the brand name only has to be changed in one place (`BRAND_NAME`) to
update it everywhere. Nothing in `pages/Home.tsx` or the layout components
references a branch by name directly — they all iterate over `LOCATIONS`,
so the UI stays correct as branches are added, renamed, or removed.

### Why some folders are empty

`booking/`, `dashboard/`, `hooks/`, `schemas/`, `services/`, and `context/`
are intentionally empty. They exist now so that when the next features are
built, each piece has an obvious, pre-agreed home:

- **Booking system** → `services/bookings.ts` (Supabase queries/mutations),
  `schemas/booking.schema.ts` (Zod validation), `components/booking/*`
  (UI), `hooks/useBooking*.ts` (TanStack Query hooks).
- **Temporary reservation lock (5 min)** → a `reservation_locks` table
  (or a `status`/`locked_until` column) driven by `services/locks.ts`;
  the lock duration is already configurable via
  `VITE_RESERVATION_LOCK_MINUTES` in `src/config/env.ts`.
- **Payment screenshot upload** → Supabase Storage bucket named by
  `VITE_SUPABASE_PAYMENTS_BUCKET`, uploaded via a future
  `services/payments.ts`.
- **Dashboard analytics** → `components/dashboard/*` + TanStack Query
  hooks reading from Postgres views/RPCs once the schema exists.
- **Booking conflict prevention** → enforced at the database layer
  (unique constraint / exclusion constraint on `sub_field_id` + time
  range) once the `bookings` table is designed — deliberately not
  faked at the frontend.

## Database (Supabase / Postgres)

The schema — core tables, settings/payment_methods/booking_events,
storage setup, admin dashboard RPCs, constraints, indexes, triggers for
booking-conflict prevention, and Row Level Security — lives in:

```
supabase/
  migrations/
    20260804000000_phase2_database_architecture.sql   # tables, RLS, constraints
    20260804010000_phase3_business_logic.sql            # settings, RPCs, audit log
    20260806000000_phase4_storage_setup.sql              # payment-screenshots bucket + RLS
    20260808000000_phase4_2_admin_dashboard.sql            # admin-gated stats/schedule/revenue RPCs
    20260810000000_phase4_3_closures_and_storage_hardening.sql  # closed_slots hardening, storage bucket limits
    20260812000000_phase5_realtime.sql                            # enables Realtime on admin-visible tables
  seed.sql          # idempotent: branches/sections + settings/payment methods
docs/
  DATABASE.md              # Phase 2: table explanations, ER diagram, indexes, RLS
  BUSINESS_LOGIC.md         # Phase 3: RPC contracts, error codes, status workflow,
                             # settings, testing instructions
  ADMIN_DASHBOARD.md        # Phase 4.2-4.3: admin RPCs, closures, storage hardening,
                             # how to create the first admin, limitations
  REALTIME.md                # Phase 5: why admin gets true Realtime, customers get polling
  PRODUCTION_CHECKLIST.md     # Full go-live checklist for a real Supabase project
```

**All six migrations have been executed and tested** against a real
local Postgres 16 instance — 92 automated integration tests (see
`tests/rpc/`, run with `npm test`) plus additional manual concurrency
testing during development. Not yet applied to a live Supabase project.

To apply it once you have a Supabase project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

There is no self-registration for the admin dashboard — see
`docs/ADMIN_DASHBOARD.md` for the two manual steps to create the first
admin account before `/dashboard/login` will work.

**All booking writes go through RPCs, never direct table access from the
frontend** — see `docs/BUSINESS_LOGIC.md` §1 for why. The service layer
in `src/services/` wraps every RPC; no component should call Supabase
directly.

No booking UI or admin dashboard exist yet — those are Phase 4+.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Then fill in your Supabase project's URL and anon key (Supabase Dashboard →
Project Settings → API):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

> The app throws a clear error at startup if these are missing — see
> `src/config/env.ts`.

### 3. Run the dev server

```bash
npm run dev
```

Visit `http://localhost:5173`.

### 4. Other scripts

```bash
npm run build       # type-check + production build
npm run preview     # preview the production build locally
npm run lint         # oxlint
npm test              # run the RPC integration test suite (needs a real Postgres — see below)
npm run test:watch    # same, in watch mode
```

### 5. Running the integration test suite

The 92 tests in `tests/rpc/` run real SQL against a real Postgres
instance (all migrations + seed data applied) — not mocks. Point
`TEST_DATABASE_URL` at a disposable database:

```bash
export TEST_DATABASE_URL="postgresql://user:pass@host:5432/dbname"
for f in supabase/migrations/*.sql; do psql "$TEST_DATABASE_URL" -f "$f"; done
psql "$TEST_DATABASE_URL" -f supabase/seed.sql
npm test
```

Never point this at a production database — tests `TRUNCATE`
transactional tables between runs. See `docs/BUSINESS_LOGIC.md` §10 and
`docs/ADMIN_DASHBOARD.md` for details on what each test file covers.

## Adding more shadcn/ui components

This environment couldn't reach `ui.shadcn.com` to run the CLI, so the
initial primitives (Button, Card, Badge, Skeleton, Sonner) were added by
hand, matching the CLI's exact output. On a machine with normal internet
access, use the CLI as usual for anything else you need:

```bash
npx shadcn@latest add input select dialog dropdown-menu
```

`components.json` is already configured (New York style, neutral base
color, CSS variables, `@/*` aliases) so the CLI will drop files straight
into `src/components/ui/`.

## What's intentionally NOT here yet

- The database migrations exist (`supabase/migrations/`) but have **not
  been applied to a live Supabase project** — only tested locally.
- **Anonymous customer receipt uploads are unverified against real
  Supabase Storage** — the RLS policies are correct and tested at the
  SQL level, but whether `supabase.storage.upload()` actually succeeds
  end-to-end for an anonymous customer against a live project has not
  been confirmed. See `docs/PRODUCTION_CHECKLIST.md` §5 before launch.
- **Realtime message delivery is unverified against a live Supabase
  project** — the enabling migration and its guard logic are tested;
  actually receiving a push event in a browser cannot be exercised from
  local Postgres alone (no logical-replication Realtime server here).
  See `docs/PRODUCTION_CHECKLIST.md` §6. Admin dashboard pages have
  genuine Realtime subscriptions (`src/hooks/useRealtimeInvalidate.ts`);
  the customer-facing slot grid uses 15s polling instead, by design —
  see `docs/REALTIME.md` for why (RLS correctly blocks anon from
  subscribing to booking data at all).
- No WhatsApp/notification sending — only the `notification_status`/
  `notification_sent_at`/`notification_error` columns exist, as
  instructed ("prepare for it", not "build it").
- No deployment automation/CI.

These are documented, deliberate scope boundaries — not oversights. See
`docs/PRODUCTION_CHECKLIST.md` for the full go-live checklist.
