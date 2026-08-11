import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withAnon, pool, closePool, type PgError } from "./helpers/db";
import { loadFixtures, freshSessionId, type SeededFixtures } from "./helpers/testData";

describe("security hardening", () => {
  let fx: SeededFixtures;

  beforeAll(async () => {
    fx = await loadFixtures();
  });
  afterAll(async () => {
    await pool.query("truncate table booking_events, bookings, booking_locks restart identity cascade");
    await closePool();
  });

  it("anon cannot call internal helper functions directly (compute_session_window)", async () => {
    await expect(
      withAnon((client) => client.query("select public.compute_session_window(now())"))
    ).rejects.toMatchObject({ code: "42501" } satisfies Partial<PgError>); // insufficient_privilege
  });

  it("anon cannot call log_booking_event directly", async () => {
    await expect(
      withAnon((client) =>
        client.query("select public.log_booking_event(null, null, 'LOCK_CREATED', '{}'::jsonb)")
      )
    ).rejects.toMatchObject({ code: "42501" } satisfies Partial<PgError>);
  });

  it("anon cannot call generate_booking_reference directly", async () => {
    await expect(
      withAnon((client) => client.query("select public.generate_booking_reference()"))
    ).rejects.toMatchObject({ code: "42501" } satisfies Partial<PgError>);
  });

  it("anon can still call is_admin() (used inside RLS policies under anon's own context)", async () => {
    const result = await withAnon((client) => client.query("select public.is_admin() as result"));
    expect(result.rows[0].result).toBe(false);
  });

  it("anon CANNOT insert directly into bookings (Phase 3 tightening — RPC only)", async () => {
    await expect(
      withAnon((client) =>
        client.query(
          `insert into bookings (branch_id, field_section_id, customer_name, customer_phone, starts_at, ends_at)
           values ($1, $2, 'Direct Insert', '+201234567890', '2026-11-01T18:00:00Z', '2026-11-01T19:00:00Z')`,
          [fx.mubarak.branchId, fx.mubarak.a.id]
        )
      )
    ).rejects.toMatchObject({ code: "42501" } satisfies Partial<PgError>); // permission denied (grant revoked)
  });

  it("anon CANNOT insert directly into booking_locks (Phase 3 tightening — RPC only)", async () => {
    await expect(
      withAnon((client) =>
        client.query(
          `insert into booking_locks (field_section_id, session_id, starts_at, ends_at)
           values ($1, $2, '2026-11-01T18:00:00Z', '2026-11-01T19:00:00Z')`,
          [fx.mubarak.a.id, freshSessionId()]
        )
      )
    ).rejects.toMatchObject({ code: "42501" } satisfies Partial<PgError>);
  });

  it("anon CAN still read public settings directly (not RPC-gated)", async () => {
    const result = await withAnon((client) =>
      client.query("select value from settings where key = 'brand_name'")
    );
    expect(result.rows[0].value).toBe("ملعب الوطن");
  });

  it("anon CAN read active payment_methods but not inactive ones", async () => {
    const result = await withAnon((client) => client.query("select code from payment_methods order by code"));
    const codes = result.rows.map((r) => r.code);
    expect(codes).toEqual(["vodafone_cash"]); // only active one is visible
  });

  it("anon cannot read booking_events at all — no grant exists, not just RLS-filtered", async () => {
    await expect(
      withAnon((client) => client.query("select count(*) from booking_events"))
    ).rejects.toMatchObject({ code: "42501" } satisfies Partial<PgError>);
  });
});
