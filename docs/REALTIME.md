# Realtime — ملعب الوطن (Malaab Al Watan)

**Phase 5 deliverable.** Migration: [`20260812000000_phase5_realtime.sql`](../supabase/migrations/20260812000000_phase5_realtime.sql).
Tests: [`tests/rpc/realtimePublication.test.ts`](../tests/rpc/realtimePublication.test.ts) (3 tests).

## Why admin gets true Realtime and customers get polling — not a compromise, a consequence of RLS

`bookings`, `booking_locks`, `payment_receipts`, and `closed_slots` are
added to Supabase's `supabase_realtime` publication. Supabase Realtime's
`postgres_changes` respects each table's RLS for the subscribing
connection's JWT — exactly like a normal query would. Since `anon` has no
`SELECT` policy on any of these four tables (deliberately, to protect
customer PII — see `docs/DATABASE.md`), an anon Realtime subscription to
them would simply never receive an event. There is no way to give
customers genuine Realtime on "is this slot still free" without either
weakening that RLS (not acceptable — rule: don't weaken security for UI
convenience) or building a separate PII-free realtime channel.

**Admin dashboard** (`src/hooks/useRealtimeInvalidate.ts`, wired into
`Overview.tsx`, `Bookings.tsx`, `Schedule.tsx`): genuine `postgres_changes`
subscriptions. On any change, the hook **only invalidates a React Query
key** — it never applies the realtime payload to UI state directly. The
subsequent refetch goes through the exact same RPC/service calls the page
already uses, so `get_admin_schedule`'s cross-section conflict logic (etc.)
is still the only place availability is computed.

**Customer slot grid** (`src/hooks/useSlotGrid.ts`): 15-second
`refetchInterval` polling through `get_available_slots` — the same
authoritative RPC, just asked more often while the grid is open. This is
the secure alternative for a role that correctly has no read access to
the underlying tables.

**Lock expiration** (`src/hooks/useCountdown.ts`) doesn't need Realtime at
all — it was already correct since Milestone 1: the countdown is driven
by the lock's own absolute `expires_at`, recomputed from `Date.now()`,
not a push notification.

## What is and isn't verified

The migration's *guard logic* (safe no-op without a `supabase_realtime`
publication; correct, idempotent table additions when one exists) is
tested directly against local Postgres — 3 passing tests. **Actual
message delivery cannot be tested in this sandbox** — local Postgres has
no logical-replication-backed Realtime server consuming the WAL the way a
real Supabase project does. The subscription/cleanup code has been
verified to type-check and to not crash the dev server, but a live
Supabase project is required to confirm an admin's browser actually
receives an event when another admin (or a customer via an RPC) changes
a row. See the Production Checklist for the concrete steps to verify
this once deployed.
