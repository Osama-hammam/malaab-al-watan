import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { withAnon, withAuthenticated, pool, resetTransactionalData, closePool } from "./helpers/db";
import { loadFixtures, freshSessionId, type SeededFixtures } from "./helpers/testData";
import { callCreateBookingLock, callConfirmBooking } from "./helpers/rpc";

async function ensureAdmin(): Promise<string> {
  const admin = await pool.query<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [`storage-admin-${Date.now()}@malaabalwatan.com`]
  );
  await pool.query("insert into admin_users (user_id, full_name) values ($1, 'Test Owner')", [admin.rows[0].id]);
  return admin.rows[0].id;
}

describe("payment-screenshots Storage security", () => {
  let fx: SeededFixtures;
  let adminId: string;
  let bookingAId: string;
  let bookingBId: string;

  beforeAll(async () => {
    fx = await loadFixtures();
  });

  beforeEach(async () => {
    await resetTransactionalData();
    await pool.query("truncate table admin_users cascade");
    await pool.query("truncate table storage.objects");
    adminId = await ensureAdmin();

    // Two independent bookings, simulating two different customers.
    const sessionA = freshSessionId();
    const lockA = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-12-01T18:00:00Z", "2026-12-01T19:00:00Z", sessionA)
    );
    const bookingA = await withAnon((client) =>
      callConfirmBooking(client, lockA.lock_id, sessionA, "Customer A", "+201111111111")
    );
    bookingAId = bookingA.booking_id;

    const sessionB = freshSessionId();
    const lockB = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.b.id, "2026-12-01T18:00:00Z", "2026-12-01T19:00:00Z", sessionB)
    );
    const bookingB = await withAnon((client) =>
      callConfirmBooking(client, lockB.lock_id, sessionB, "Customer B", "+201222222222")
    );
    bookingBId = bookingB.booking_id;
  });

  afterAll(async () => {
    await closePool();
  });

  it("anon can upload to a valid receipts/<existing-booking-id>/... path", async () => {
    // No RETURNING here: it requires SELECT-level visibility on the row,
    // which anon correctly lacks (same class of finding as Phase 2's
    // "INSERT...RETURNING requires SELECT" — confirmed by testing: this
    // exact insert fails with RETURNING and succeeds without it). The
    // real Supabase Storage API (supabase.storage.upload) never performs
    // a raw SQL RETURNING, so this accurately reflects what the actual
    // upload code does. Verify success by checking as admin afterward.
    await withAnon((client) =>
      client.query("insert into storage.objects (bucket_id, name) values ('payment-screenshots', $1)", [
        `receipts/${bookingAId}/proof.jpg`,
      ])
    );

    const result = await withAuthenticated(adminId, (client) =>
      client.query("select id from storage.objects where name = $1", [`receipts/${bookingAId}/proof.jpg`])
    );
    expect(result.rows).toHaveLength(1);
  });

  it("anon CANNOT upload to a made-up/nonexistent booking id path", async () => {
    await expect(
      withAnon((client) =>
        client.query("insert into storage.objects (bucket_id, name) values ('payment-screenshots', $1)", [
          "receipts/00000000-0000-0000-0000-000000000000/proof.jpg",
        ])
      )
    ).rejects.toThrow();
  });

  it("anon CANNOT upload outside the receipts/ prefix", async () => {
    await expect(
      withAnon((client) =>
        client.query("insert into storage.objects (bucket_id, name) values ('payment-screenshots', $1)", [
          `evil/${bookingAId}/proof.jpg`,
        ])
      )
    ).rejects.toThrow();
  });

  it("anon CANNOT upload with extra nested path segments", async () => {
    await expect(
      withAnon((client) =>
        client.query("insert into storage.objects (bucket_id, name) values ('payment-screenshots', $1)", [
          `receipts/${bookingAId}/nested/proof.jpg`,
        ])
      )
    ).rejects.toThrow();
  });

  it("anon (including the uploader's own session) CANNOT read back any storage object — no customer-facing read path exists at all", async () => {
    await withAnon((client) =>
      client.query("insert into storage.objects (bucket_id, name) values ('payment-screenshots', $1)", [
        `receipts/${bookingAId}/proof.jpg`,
      ])
    );

    const result = await withAnon((client) => client.query("select count(*) from storage.objects"));
    expect(result.rows[0].count).toBe("0"); // RLS: zero visible rows, not an error
  });

  it("customer A's session cannot read customer B's receipt object (or vice versa) — neither can read ANY receipt, satisfying isolation", async () => {
    await withAnon((client) =>
      client.query("insert into storage.objects (bucket_id, name) values ('payment-screenshots', $1)", [
        `receipts/${bookingAId}/proof.jpg`,
      ])
    );
    await withAnon((client) =>
      client.query("insert into storage.objects (bucket_id, name) values ('payment-screenshots', $1)", [
        `receipts/${bookingBId}/proof.jpg`,
      ])
    );

    // Neither anon session (regardless of which booking it "belongs" to
    // conceptually — anon has no persistent identity) can select anything.
    const result = await withAnon((client) => client.query("select name from storage.objects"));
    expect(result.rows).toHaveLength(0);
  });

  it("admin CAN read storage objects (needed to review receipts)", async () => {
    await withAnon((client) =>
      client.query("insert into storage.objects (bucket_id, name) values ('payment-screenshots', $1)", [
        `receipts/${bookingAId}/proof.jpg`,
      ])
    );

    const result = await withAuthenticated(adminId, (client) =>
      client.query("select name from storage.objects where bucket_id = 'payment-screenshots'")
    );
    expect(result.rows).toHaveLength(1);
  });

  it("non-admin authenticated CANNOT read storage objects", async () => {
    const nonAdmin = await pool.query<{ id: string }>(
      "insert into auth.users (email) values ($1) returning id",
      [`storage-nonadmin-${Date.now()}@example.com`]
    );

    await withAnon((client) =>
      client.query("insert into storage.objects (bucket_id, name) values ('payment-screenshots', $1)", [
        `receipts/${bookingAId}/proof.jpg`,
      ])
    );

    const result = await withAuthenticated(nonAdmin.rows[0].id, (client) =>
      client.query("select name from storage.objects")
    );
    expect(result.rows).toHaveLength(0);
  });

  it("bucket is private (public=false) and has size/mime limits configured", async () => {
    const result = await pool.query(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'payment-screenshots'"
    );
    expect(result.rows[0].public).toBe(false);
    expect(result.rows[0].file_size_limit).toBe("10485760"); // 10MB, matches payment_receipts_file_size_check
    expect(result.rows[0].allowed_mime_types).toEqual(
      expect.arrayContaining(["image/jpeg", "image/png", "image/webp", "application/pdf"])
    );
  });
});
