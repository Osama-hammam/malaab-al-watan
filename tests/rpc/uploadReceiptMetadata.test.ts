import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { withAnon, pool, resetTransactionalData, closePool, type PgError } from "./helpers/db";
import { loadFixtures, freshSessionId, type SeededFixtures } from "./helpers/testData";
import { callCreateBookingLock, callConfirmBooking, callUploadReceiptMetadata } from "./helpers/rpc";

describe("upload_receipt_metadata", () => {
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

  async function makeBooking() {
    const sessionId = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", sessionId)
    );
    return withAnon((client) =>
      callConfirmBooking(client, lock.lock_id, sessionId, "Receipt Tester", "+201234567899")
    );
  }

  it("accepts a receipt with the correct access_token", async () => {
    const booking = await makeBooking();
    const result = await withAnon((client) =>
      callUploadReceiptMetadata(
        client,
        booking.booking_id,
        booking.access_token,
        "receipts/2026/08/img1.jpg",
        "vodafone_cash",
        "image/jpeg",
        200000
      )
    );
    expect(result.review_status).toBe("pending");
    expect(result.receipt_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects the WRONG access_token", async () => {
    const booking = await makeBooking();
    await expect(
      withAnon((client) =>
        callUploadReceiptMetadata(
          client,
          booking.booking_id,
          "00000000-0000-0000-0000-000000000000",
          "receipts/2026/08/hack.jpg",
          "vodafone_cash",
          "image/jpeg",
          150000
        )
      )
    ).rejects.toMatchObject({ code: "42501" } satisfies Partial<PgError>);
  });

  it("rejects a duplicate upload while one is still pending review", async () => {
    const booking = await makeBooking();
    await withAnon((client) =>
      callUploadReceiptMetadata(
        client,
        booking.booking_id,
        booking.access_token,
        "receipts/2026/08/img1.jpg",
        "vodafone_cash",
        "image/jpeg",
        200000
      )
    );

    await expect(
      withAnon((client) =>
        callUploadReceiptMetadata(
          client,
          booking.booking_id,
          booking.access_token,
          "receipts/2026/08/img2.jpg",
          "vodafone_cash",
          "image/jpeg",
          150000
        )
      )
    ).rejects.toMatchObject({ code: "23505" } satisfies Partial<PgError>);
  });

  it("rejects an oversized file (> 10MB)", async () => {
    const booking = await makeBooking();
    await expect(
      withAnon((client) =>
        callUploadReceiptMetadata(
          client,
          booking.booking_id,
          booking.access_token,
          "receipts/2026/08/huge.jpg",
          "vodafone_cash",
          "image/jpeg",
          99_999_999
        )
      )
    ).rejects.toMatchObject({ code: "22023" } satisfies Partial<PgError>);
  });

  it("rejects an inactive payment method", async () => {
    const booking = await makeBooking();
    await expect(
      withAnon((client) =>
        callUploadReceiptMetadata(
          client,
          booking.booking_id,
          booking.access_token,
          "receipts/2026/08/insta.jpg",
          "instapay",
          "image/jpeg",
          150000
        )
      )
    ).rejects.toMatchObject({ code: "22023" } satisfies Partial<PgError>);
  });

  it("rejects an unsupported mime type", async () => {
    const booking = await makeBooking();
    await expect(
      withAnon((client) =>
        callUploadReceiptMetadata(
          client,
          booking.booking_id,
          booking.access_token,
          "receipts/2026/08/doc.exe",
          "vodafone_cash",
          "application/x-msdownload",
          150000
        )
      )
    ).rejects.toMatchObject({ code: "22023" } satisfies Partial<PgError>);
  });

  it("logs a PAYMENT_UPLOADED event automatically", async () => {
    const booking = await makeBooking();
    await withAnon((client) =>
      callUploadReceiptMetadata(
        client,
        booking.booking_id,
        booking.access_token,
        "receipts/2026/08/img1.jpg",
        "vodafone_cash",
        "image/jpeg",
        200000
      )
    );

    const { rows } = await pool.query(
      "select event_type from booking_events where booking_id = $1 and event_type = 'PAYMENT_UPLOADED'",
      [booking.booking_id]
    );
    expect(rows).toHaveLength(1);
  });
});
