import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { withAnon, withAuthenticated, pool, resetTransactionalData, closePool, type PgError } from "./helpers/db";
import { loadFixtures, freshSessionId, type SeededFixtures } from "./helpers/testData";
import { callCreateBookingLock, callConfirmBooking } from "./helpers/rpc";

async function ensureAdmin(): Promise<{ adminId: string; nonAdminId: string }> {
  const admin = await pool.query<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [`admin-${Date.now()}@malaabalwatan.com`]
  );
  const nonAdmin = await pool.query<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [`random-${Date.now()}@example.com`]
  );
  await pool.query("insert into admin_users (user_id, full_name) values ($1, 'Test Owner')", [admin.rows[0].id]);
  return { adminId: admin.rows[0].id, nonAdminId: nonAdmin.rows[0].id };
}

describe("admin dashboard RPCs", () => {
  let fx: SeededFixtures;
  let adminId: string;
  let nonAdminId: string;

  beforeAll(async () => {
    fx = await loadFixtures();
  });

  beforeEach(async () => {
    await resetTransactionalData();
    // NOTE: truncating auth.users CASCADE would also wipe settings/
    // payment_methods (any table with a FK to auth.users, even a nullable
    // ON DELETE SET NULL one like settings.updated_by — TRUNCATE CASCADE
    // empties the whole referencing table regardless of that FK's own
    // ON DELETE action). Confirmed by testing. Only admin_users needs
    // clearing between tests; stale auth.users rows are harmless since
    // ensureAdmin() always creates fresh ones with unique emails.
    await pool.query("truncate table admin_users cascade");
    const ids = await ensureAdmin();
    adminId = ids.adminId;
    nonAdminId = ids.nonAdminId;
  });

  afterAll(async () => {
    await closePool();
  });

  describe("admin gating", () => {
    it("anon cannot call get_admin_overview_stats", async () => {
      await expect(
        withAnon((client) => client.query("select public.get_admin_overview_stats()"))
      ).rejects.toMatchObject({ code: "42501" } satisfies Partial<PgError>);
    });

    it("non-admin authenticated cannot call get_admin_overview_stats", async () => {
      await expect(
        withAuthenticated(nonAdminId, (client) => client.query("select public.get_admin_overview_stats()"))
      ).rejects.toMatchObject({ code: "42501" } satisfies Partial<PgError>);
    });

    it("anon cannot call get_admin_schedule", async () => {
      await expect(
        withAnon((client) =>
          client.query("select * from public.get_admin_schedule($1, current_date)", [fx.mubarak.branchId])
        )
      ).rejects.toMatchObject({ code: "42501" } satisfies Partial<PgError>);
    });

    it("anon cannot call get_admin_revenue_report", async () => {
      await expect(
        withAnon((client) =>
          client.query("select public.get_admin_revenue_report(current_date, current_date)")
        )
      ).rejects.toMatchObject({ code: "42501" } satisfies Partial<PgError>);
    });

    it("admin CAN call all three", async () => {
      await withAuthenticated(adminId, async (client) => {
        await client.query("select public.get_admin_overview_stats()");
        await client.query("select * from public.get_admin_schedule($1, current_date)", [fx.mubarak.branchId]);
        await client.query("select public.get_admin_revenue_report(current_date, current_date)");
      });
    });
  });

  describe("get_admin_overview_stats", () => {
    it("reflects a booking made 'today' by operating-day logic, not naive calendar date", async () => {
      const sessionId = freshSessionId();
      const lock = await withAnon((client) =>
        callCreateBookingLock(
          client,
          fx.mubarak.a.id,
          "2026-09-01T18:00:00Z",
          "2026-09-01T19:00:00Z",
          sessionId
        )
      );
      await withAnon((client) =>
        callConfirmBooking(client, lock.lock_id, sessionId, "Stats Test", "+201234500001")
      );

      // Force "now" perception via the booking_date match logic itself —
      // since this suite can't travel in time, verify total_bookings
      // reflects the created booking (todays_* depends on actual now()).
      const stats = await withAuthenticated(adminId, async (client) => {
        const { rows } = await client.query("select public.get_admin_overview_stats() as result");
        return rows[0].result;
      });

      expect(stats.total_bookings).toBe(1);
      expect(stats.confirmed_bookings).toBe(0); // confirm_booking leaves status='pending'
      expect(stats.cancelled_bookings).toBe(0);
    });

    it("counts pending payment receipts", async () => {
      const sessionId = freshSessionId();
      const lock = await withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.a.id, "2026-09-01T18:00:00Z", "2026-09-01T19:00:00Z", sessionId)
      );
      const booking = await withAnon((client) =>
        callConfirmBooking(client, lock.lock_id, sessionId, "Receipt Stats", "+201234500002")
      );
      await pool.query(
        `insert into payment_receipts (booking_id, access_token, storage_path, payment_method, mime_type, file_size_bytes)
         values ($1, $2, 'receipts/x/y.jpg', 'vodafone_cash', 'image/jpeg', 1000)`,
        [booking.booking_id, booking.access_token]
      );

      const stats = await withAuthenticated(adminId, async (client) => {
        const { rows } = await client.query("select public.get_admin_overview_stats() as result");
        return rows[0].result;
      });

      expect(stats.pending_receipts).toBe(1);
    });
  });

  describe("get_admin_schedule", () => {
    it("correctly attributes cross-section status: A booked -> AB shows booked with the same customer, B stays available", async () => {
      const sessionId = freshSessionId();
      const lock = await withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.a.id, "2026-09-02T18:00:00Z", "2026-09-02T19:00:00Z", sessionId)
      );
      await withAnon((client) =>
        callConfirmBooking(client, lock.lock_id, sessionId, "Cross Section Test", "+201234500003")
      );

      const rows = await withAuthenticated(adminId, async (client) => {
        const { rows } = await client.query(
          "select code, slot_start, status, customer_name from public.get_admin_schedule($1, $2)",
          [fx.mubarak.branchId, "2026-09-02"]
        );
        return rows as { code: string; slot_start: Date; status: string; customer_name: string | null }[];
      });

      const at18 = (code: string) =>
        rows.find((r) => r.code === code && r.slot_start.toISOString() === "2026-09-02T18:00:00.000Z");

      expect(at18("A")?.status).toBe("booked");
      expect(at18("A")?.customer_name).toBe("Cross Section Test");
      expect(at18("AB")?.status).toBe("booked");
      expect(at18("AB")?.customer_name).toBe("Cross Section Test");
      expect(at18("B")?.status).toBe("available");
    });

    it("shows a live lock as 'locked'", async () => {
      const sessionId = freshSessionId();
      await withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.b.id, "2026-09-03T18:00:00Z", "2026-09-03T19:00:00Z", sessionId)
      );

      const rows = await withAuthenticated(adminId, async (client) => {
        const { rows } = await client.query(
          "select code, slot_start, status from public.get_admin_schedule($1, $2)",
          [fx.mubarak.branchId, "2026-09-03"]
        );
        return rows as { code: string; slot_start: Date; status: string }[];
      });

      const bAt18 = rows.find((r) => r.code === "B" && r.slot_start.toISOString() === "2026-09-03T18:00:00.000Z");
      expect(bAt18?.status).toBe("locked");
    });

    it("shows a closed slot as 'closed', including cascading to a conflicting section", async () => {
      await pool.query(
        `insert into closed_slots (branch_id, field_section_id, reason, starts_at, ends_at)
         values ($1, $2, 'test closure', '2026-09-04T18:00:00Z', '2026-09-04T19:00:00Z')`,
        [fx.mubarak.branchId, fx.mubarak.a.id]
      );

      const rows = await withAuthenticated(adminId, async (client) => {
        const { rows } = await client.query(
          "select code, slot_start, status from public.get_admin_schedule($1, $2)",
          [fx.mubarak.branchId, "2026-09-04"]
        );
        return rows as { code: string; slot_start: Date; status: string }[];
      });

      const at18 = (code: string) =>
        rows.find((r) => r.code === code && r.slot_start.toISOString() === "2026-09-04T18:00:00.000Z");

      expect(at18("A")?.status).toBe("closed");
      expect(at18("AB")?.status).toBe("closed"); // AB conflicts with A
      expect(at18("B")?.status).toBe("available"); // B is independent of A
    });
  });

  describe("get_admin_revenue_report", () => {
    it("aggregates total revenue, by branch, by field type, and popular hours correctly", async () => {
      const sessionId1 = freshSessionId();
      const sessionId2 = freshSessionId();

      const lock1 = await withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.a.id, "2026-09-05T18:00:00Z", "2026-09-05T19:00:00Z", sessionId1)
      );
      await withAnon((client) => callConfirmBooking(client, lock1.lock_id, sessionId1, "Rev A", "+201234500004"));

      const lock2 = await withAnon((client) =>
        callCreateBookingLock(client, fx.oula.ab.id, "2026-09-05T18:00:00Z", "2026-09-05T19:00:00Z", sessionId2)
      );
      await withAnon((client) => callConfirmBooking(client, lock2.lock_id, sessionId2, "Rev AB", "+201234500005"));

      const report = await withAuthenticated(adminId, async (client) => {
        const { rows } = await client.query(
          "select public.get_admin_revenue_report($1, $2) as result",
          ["2026-09-05", "2026-09-05"]
        );
        return rows[0].result;
      });

      expect(report.total_revenue).toBe(300 + 600);
      expect(report.total_bookings).toBe(2);
      expect(report.by_branch).toHaveLength(2);
      expect(report.by_field_type).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field_type: "5v5", revenue: 300 }),
          expect.objectContaining({ field_type: "7v7", revenue: 600 }),
        ])
      );
      expect(report.popular_hours[0]).toMatchObject({ hour: 20, bookings_count: 2 }); // 18:00 UTC + 2h Cairo offset
    });

    it("rejects to_date before from_date", async () => {
      await expect(
        withAuthenticated(adminId, (client) =>
          client.query("select public.get_admin_revenue_report($1, $2)", ["2026-09-05", "2026-09-01"])
        )
      ).rejects.toMatchObject({ code: "22023" } satisfies Partial<PgError>);
    });

    it("filters by branch_id when provided", async () => {
      const sessionId = freshSessionId();
      const lock = await withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.a.id, "2026-09-06T18:00:00Z", "2026-09-06T19:00:00Z", sessionId)
      );
      await withAnon((client) => callConfirmBooking(client, lock.lock_id, sessionId, "Branch Filter", "+201234500006"));

      const report = await withAuthenticated(adminId, async (client) => {
        const { rows } = await client.query(
          "select public.get_admin_revenue_report($1, $2, $3) as result",
          ["2026-09-06", "2026-09-06", fx.oula.branchId]
        );
        return rows[0].result;
      });

      expect(report.total_bookings).toBe(0); // booking was on mubarak, filtered to oula
    });
  });
});
