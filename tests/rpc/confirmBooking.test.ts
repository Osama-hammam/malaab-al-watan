import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { withAnon, pool, resetTransactionalData, closePool, type PgError } from "./helpers/db";
import { loadFixtures, freshSessionId, type SeededFixtures } from "./helpers/testData";
import { callCreateBookingLock, callConfirmBooking } from "./helpers/rpc";

describe("confirm_booking", () => {
  let fx: SeededFixtures;

  beforeAll(async () => {
    fx = await loadFixtures();
  });
  beforeEach(async () => {
    await resetTransactionalData();
  });
  afterAll(async () => {
    await closePool();
  });

  async function lockAndConfirm(overrides?: { paymentMethod?: string | null }) {
    const sessionId = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", sessionId)
    );
    const booking = await withAnon((client) =>
      callConfirmBooking(
        client,
        lock.lock_id,
        sessionId,
        "Ahmed Test",
        "+201234567890",
        overrides?.paymentMethod ?? "vodafone_cash"
      )
    );
    return { sessionId, lock, booking };
  }

  it("converts a lock into a pending booking with a correct reference/price/token", async () => {
    const { booking } = await lockAndConfirm();

    expect(booking.status).toBe("pending");
    expect(booking.price).toBe(300); // section A price
    expect(booking.booking_reference).toMatch(/^WTN-\d{8}-\d{6}$/);
    expect(booking.access_token).toMatch(/^[0-9a-f-]{36}$/);
    expect(booking.booking_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("consumes the lock — it no longer exists after confirmation", async () => {
    const { lock } = await lockAndConfirm();
    const { rows } = await pool.query("select 1 from booking_locks where id = $1", [lock.lock_id]);
    expect(rows).toHaveLength(0);
  });

  it("rejects confirmation with the WRONG session_id", async () => {
    const sessionId = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", sessionId)
    );

    await expect(
      withAnon((client) =>
        callConfirmBooking(client, lock.lock_id, "not-the-owner", "Someone", "+201111111111")
      )
    ).rejects.toMatchObject({ code: "P0002" } satisfies Partial<PgError>);
  });

  it("rejects confirming the SAME lock twice", async () => {
    const { lock, sessionId } = await lockAndConfirm();

    await expect(
      withAnon((client) => callConfirmBooking(client, lock.lock_id, sessionId, "Again", "+201234567891"))
    ).rejects.toMatchObject({ code: "P0002" } satisfies Partial<PgError>);
  });

  it("rejects confirmation of an EXPIRED lock", async () => {
    const sessionId = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", sessionId)
    );

    await pool.query("update booking_locks set expires_at = now() - interval '1 minute' where id = $1", [
      lock.lock_id,
    ]);

    await expect(
      withAnon((client) =>
        callConfirmBooking(client, lock.lock_id, sessionId, "Late Ahmed", "+201234567892")
      )
    ).rejects.toMatchObject({ code: "P0002" } satisfies Partial<PgError>);
  });

  it("rejects an inactive payment method", async () => {
    const sessionId = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", sessionId)
    );

    await expect(
      withAnon((client) =>
        callConfirmBooking(client, lock.lock_id, sessionId, "Bad Pay", "+201234567893", "instapay")
      )
    ).rejects.toMatchObject({ code: "22023" } satisfies Partial<PgError>);
  });

  it("rejects a blank customer_name", async () => {
    const sessionId = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", sessionId)
    );

    await expect(
      withAnon((client) => callConfirmBooking(client, lock.lock_id, sessionId, "  ", "+201234567894"))
    ).rejects.toMatchObject({ code: "22023" } satisfies Partial<PgError>);
  });

  it("generates strictly sequential references for confirmations on the same day", async () => {
    const sessionId1 = freshSessionId();
    const sessionId2 = freshSessionId();

    const lock1 = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", sessionId1)
    );
    const lock2 = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.b.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", sessionId2)
    );

    const b1 = await withAnon((client) =>
      callConfirmBooking(client, lock1.lock_id, sessionId1, "First", "+201000000001")
    );
    const b2 = await withAnon((client) =>
      callConfirmBooking(client, lock2.lock_id, sessionId2, "Second", "+201000000002")
    );

    const seq1 = parseInt(b1.booking_reference.split("-")[2], 10);
    const seq2 = parseInt(b2.booking_reference.split("-")[2], 10);
    expect(seq2).toBe(seq1 + 1);
  });
});
