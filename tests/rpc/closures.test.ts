import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { withAnon, withAuthenticated, pool, resetTransactionalData, closePool, type PgError } from "./helpers/db";
import { loadFixtures, freshSessionId, type SeededFixtures } from "./helpers/testData";
import { callCreateBookingLock, callConfirmBooking } from "./helpers/rpc";

async function ensureAdmin(): Promise<{ adminId: string; nonAdminId: string }> {
  const admin = await pool.query<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [`closures-admin-${Date.now()}@malaabalwatan.com`]
  );
  const nonAdmin = await pool.query<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [`closures-random-${Date.now()}@example.com`]
  );
  await pool.query("insert into admin_users (user_id, full_name) values ($1, 'Test Owner')", [admin.rows[0].id]);
  return { adminId: admin.rows[0].id, nonAdminId: nonAdmin.rows[0].id };
}

describe("closed_slots admin operations", () => {
  let fx: SeededFixtures;
  let adminId: string;
  let nonAdminId: string;

  beforeAll(async () => {
    fx = await loadFixtures();
  });

  beforeEach(async () => {
    await resetTransactionalData();
    await pool.query("truncate table admin_users cascade");
    const ids = await ensureAdmin();
    adminId = ids.adminId;
    nonAdminId = ids.nonAdminId;
  });

  afterAll(async () => {
    await closePool();
  });

  it("admin can create a section-specific closure", async () => {
    const result = await withAuthenticated(adminId, (client) =>
      client.query(
        `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
         values ($1, $2, 'Maintenance', '2026-11-10T18:00:00Z', '2026-11-10T20:00:00Z')
         returning id, created_by, field_section_id`,
        [fx.mubarak.branchId, fx.mubarak.a.id]
      )
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].created_by).toBe(adminId); // server-derived, not client-supplied
    expect(result.rows[0].field_section_id).toBe(fx.mubarak.a.id);
  });

  it("admin can create a branch-wide closure (field_section_id NULL)", async () => {
    const result = await withAuthenticated(adminId, (client) =>
      client.query(
        `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
         values ($1, null, 'Holiday', '2026-11-11T18:00:00Z', '2026-11-11T22:00:00Z')
         returning id, field_section_id`,
        [fx.mubarak.branchId]
      )
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].field_section_id).toBeNull();
  });

  it("non-admin authenticated CANNOT create a closure", async () => {
    await expect(
      withAuthenticated(nonAdminId, (client) =>
        client.query(
          `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
           values ($1, $2, 'Maintenance', '2026-11-10T18:00:00Z', '2026-11-10T20:00:00Z')`,
          [fx.mubarak.branchId, fx.mubarak.a.id]
        )
      )
    ).rejects.toThrow();
  });

  it("anon CANNOT create a closure", async () => {
    await expect(
      withAnon((client) =>
        client.query(
          `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
           values ($1, $2, 'Maintenance', '2026-11-10T18:00:00Z', '2026-11-10T20:00:00Z')`,
          [fx.mubarak.branchId, fx.mubarak.a.id]
        )
      )
    ).rejects.toThrow();
  });

  it("admin can delete a closure", async () => {
    const created = await withAuthenticated(adminId, (client) =>
      client.query(
        `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
         values ($1, $2, 'Maintenance', '2026-11-12T18:00:00Z', '2026-11-12T20:00:00Z')
         returning id`,
        [fx.mubarak.branchId, fx.mubarak.a.id]
      )
    );
    const closureId = created.rows[0].id;

    const deleted = await withAuthenticated(adminId, (client) =>
      client.query("delete from closed_slots where id = $1 returning id", [closureId])
    );
    expect(deleted.rows).toHaveLength(1);
  });

  it("non-admin authenticated CANNOT delete a closure", async () => {
    const created = await withAuthenticated(adminId, (client) =>
      client.query(
        `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
         values ($1, $2, 'Maintenance', '2026-11-13T18:00:00Z', '2026-11-13T20:00:00Z')
         returning id`,
        [fx.mubarak.branchId, fx.mubarak.a.id]
      )
    );
    const closureId = created.rows[0].id;

    const deleted = await withAuthenticated(nonAdminId, (client) =>
      client.query("delete from closed_slots where id = $1 returning id", [closureId])
    );
    // RLS silently filters — 0 rows affected, not a hard error
    expect(deleted.rows).toHaveLength(0);

    const stillExists = await pool.query("select id from closed_slots where id = $1", [closureId]);
    expect(stillExists.rows).toHaveLength(1);
  });

  it("anon CANNOT delete a closure", async () => {
    const created = await withAuthenticated(adminId, (client) =>
      client.query(
        `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
         values ($1, $2, 'Maintenance', '2026-11-14T18:00:00Z', '2026-11-14T20:00:00Z')
         returning id`,
        [fx.mubarak.branchId, fx.mubarak.a.id]
      )
    );
    const closureId = created.rows[0].id;

    await expect(
      withAnon((client) => client.query("delete from closed_slots where id = $1", [closureId]))
    ).rejects.toThrow();
  });

  it("rejects an invalid time range (ends_at <= starts_at)", async () => {
    // The generated `during tstzrange(starts_at, ends_at, '[)')` column
    // enforces lower <= upper at construction time, before
    // closed_slots_time_order_check even runs — confirmed directly
    // against Postgres. Data integrity is still fully enforced; it just
    // surfaces as 22000 (data_exception) rather than 23514
    // (check_violation) for this specific reversed-order case.
    await expect(
      withAuthenticated(adminId, (client) =>
        client.query(
          `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
           values ($1, $2, 'Maintenance', '2026-11-15T20:00:00Z', '2026-11-15T18:00:00Z')`,
          [fx.mubarak.branchId, fx.mubarak.a.id]
        )
      )
    ).rejects.toMatchObject({ code: "22000" } satisfies Partial<PgError>);
  });

  it("rejects a field_section_id that doesn't belong to the given branch_id", async () => {
    await expect(
      withAuthenticated(adminId, (client) =>
        client.query(
          `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
           values ($1, $2, 'Maintenance', '2026-11-16T18:00:00Z', '2026-11-16T20:00:00Z')`,
          [fx.oula.branchId, fx.mubarak.a.id] // mismatched branch/section
        )
      )
    ).rejects.toMatchObject({ code: "23514" } satisfies Partial<PgError>);
  });

  it("a section-specific closure appears in get_admin_schedule for that section AND cascades to a conflicting one", async () => {
    await withAuthenticated(adminId, (client) =>
      client.query(
        `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
         values ($1, $2, 'Private event', '2026-11-17T18:00:00Z', '2026-11-17T19:00:00Z')`,
        [fx.mubarak.branchId, fx.mubarak.a.id]
      )
    );

    const rows = await withAuthenticated(adminId, async (client) => {
      const { rows } = await client.query(
        "select code, slot_start, status from public.get_admin_schedule($1, $2)",
        [fx.mubarak.branchId, "2026-11-17"]
      );
      return rows as { code: string; slot_start: Date; status: string }[];
    });

    const at18 = (code: string) =>
      rows.find((r) => r.code === code && r.slot_start.toISOString() === "2026-11-17T18:00:00.000Z");

    expect(at18("A")?.status).toBe("closed");
    expect(at18("AB")?.status).toBe("closed"); // AB conflicts with A
    expect(at18("B")?.status).toBe("available"); // B independent of A
  });

  it("a branch-wide closure appears as 'closed' for ALL sections (A, B, and AB)", async () => {
    await withAuthenticated(adminId, (client) =>
      client.query(
        `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
         values ($1, null, 'Holiday', '2026-11-18T18:00:00Z', '2026-11-18T19:00:00Z')`,
        [fx.mubarak.branchId]
      )
    );

    const rows = await withAuthenticated(adminId, async (client) => {
      const { rows } = await client.query(
        "select code, slot_start, status from public.get_admin_schedule($1, $2)",
        [fx.mubarak.branchId, "2026-11-18"]
      );
      return rows as { code: string; slot_start: Date; status: string }[];
    });

    const at18 = (code: string) =>
      rows.find((r) => r.code === code && r.slot_start.toISOString() === "2026-11-18T18:00:00.000Z");

    expect(at18("A")?.status).toBe("closed");
    expect(at18("B")?.status).toBe("closed");
    expect(at18("AB")?.status).toBe("closed");
  });

  it("a closure also removes the slot from the customer-facing get_available_slots (regression: existing conflict rules still work)", async () => {
    await withAuthenticated(adminId, (client) =>
      client.query(
        `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
         values ($1, $2, 'Maintenance', '2026-11-19T18:00:00Z', '2026-11-19T19:00:00Z')`,
        [fx.mubarak.branchId, fx.mubarak.a.id]
      )
    );

    const slots = await withAnon((client) =>
      client.query("select * from public.get_available_slots($1, $2)", [fx.mubarak.a.id, "2026-11-19"])
    );
    expect(slots.rows.some((s) => new Date(s.slot_start).toISOString() === "2026-11-19T18:00:00.000Z")).toBe(false);

    // ...and booking that slot is still rejected end-to-end via the RPC too
    await expect(
      withAnon((client) =>
        callCreateBookingLock(
          client,
          fx.mubarak.a.id,
          "2026-11-19T18:00:00Z",
          "2026-11-19T19:00:00Z",
          freshSessionId()
        )
      )
    ).rejects.toMatchObject({ code: "23P01" } satisfies Partial<PgError>);
  });

  it("a closure does not interfere with an existing confirmed booking on an unrelated section (A/B independence regression)", async () => {
    const sessionId = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.b.id, "2026-11-20T18:00:00Z", "2026-11-20T19:00:00Z", sessionId)
    );
    await withAnon((client) => callConfirmBooking(client, lock.lock_id, sessionId, "Regression Test", "+201234509999"));

    await withAuthenticated(adminId, (client) =>
      client.query(
        `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
         values ($1, $2, 'Maintenance', '2026-11-20T18:00:00Z', '2026-11-20T19:00:00Z')`,
        [fx.mubarak.branchId, fx.mubarak.a.id]
      )
    );

    const booking = await pool.query("select status from bookings where customer_name = 'Regression Test'");
    expect(booking.rows[0].status).toBe("pending"); // untouched by A's closure
  });
});
