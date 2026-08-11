import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { withAnon, resetTransactionalData, closePool, type PgError } from "./helpers/db";
import { loadFixtures, freshSessionId, type SeededFixtures } from "./helpers/testData";
import { callCreateBookingLock, callConfirmBooking, callGetAvailableSlots } from "./helpers/rpc";

describe("get_available_slots", () => {
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

  it("returns 14 hourly slots for a completely free day (14:00 -> 04:00)", async () => {
    const slots = await withAnon((client) => callGetAvailableSlots(client, fx.mubarak.a.id, "2026-09-01"));
    expect(slots).toHaveLength(14);
  });

  it("excludes a slot once it's booked", async () => {
    const sessionId = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-09-01T16:00:00Z", "2026-09-01T17:00:00Z", sessionId)
    );
    await withAnon((client) =>
      callConfirmBooking(client, lock.lock_id, sessionId, "Slot Tester", "+201234567800")
    );

    const slots = await withAnon((client) => callGetAvailableSlots(client, fx.mubarak.a.id, "2026-09-01"));
    expect(slots).toHaveLength(13);
    expect(slots.some((s) => s.slot_start === "2026-09-01T16:00:00.000Z")).toBe(false);
  });

  it("a booking on A also removes that slot from AB's availability (cross-section)", async () => {
    const sessionId = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-09-01T16:00:00Z", "2026-09-01T17:00:00Z", sessionId)
    );
    await withAnon((client) =>
      callConfirmBooking(client, lock.lock_id, sessionId, "Cross Tester", "+201234567801")
    );

    const abSlots = await withAnon((client) => callGetAvailableSlots(client, fx.mubarak.ab.id, "2026-09-01"));
    expect(abSlots.some((s) => s.slot_start === "2026-09-01T16:00:00.000Z")).toBe(false);
  });

  it("a booking on A does NOT affect B's availability (independent halves)", async () => {
    const sessionId = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-09-01T16:00:00Z", "2026-09-01T17:00:00Z", sessionId)
    );
    await withAnon((client) =>
      callConfirmBooking(client, lock.lock_id, sessionId, "Independent Tester", "+201234567802")
    );

    const bSlots = await withAnon((client) => callGetAvailableSlots(client, fx.mubarak.b.id, "2026-09-01"));
    expect(bSlots).toHaveLength(14);
  });

  it("a live (unexpired) lock also removes a slot from availability", async () => {
    await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-09-02T16:00:00Z", "2026-09-02T17:00:00Z", freshSessionId())
    );

    const slots = await withAnon((client) => callGetAvailableSlots(client, fx.mubarak.a.id, "2026-09-02"));
    expect(slots.some((s) => s.slot_start === "2026-09-02T16:00:00.000Z")).toBe(false);
  });

  it("rejects a non-existent field_section_id", async () => {
    await expect(
      withAnon((client) =>
        callGetAvailableSlots(client, "00000000-0000-0000-0000-000000000000", "2026-09-01")
      )
    ).rejects.toMatchObject({ code: "23503" } satisfies Partial<PgError>);
  });
});
