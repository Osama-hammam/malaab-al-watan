import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { withAnon, resetTransactionalData, closePool, type PgError } from "./helpers/db";
import { loadFixtures, freshSessionId, type SeededFixtures } from "./helpers/testData";
import { callCreateBookingLock } from "./helpers/rpc";

describe("create_booking_lock", () => {
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

  it("creates a lock and returns lock_id, expires_at, countdown_seconds", async () => {
    const result = await withAnon((client) =>
      callCreateBookingLock(
        client,
        fx.mubarak.a.id,
        "2026-08-20T18:00:00Z",
        "2026-08-20T19:00:00Z",
        freshSessionId()
      )
    );

    expect(result.lock_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(result.expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(result.countdown_seconds).toBeGreaterThan(0);
    expect(result.countdown_seconds).toBeLessThanOrEqual(300); // default 5-minute lock
  });

  it("rejects a request outside operating hours (10:00 Cairo, field closed then)", async () => {
    await expect(
      withAnon((client) =>
        callCreateBookingLock(
          client,
          fx.mubarak.a.id,
          "2026-08-21T08:00:00Z", // 10:00 Cairo
          "2026-08-21T09:00:00Z",
          freshSessionId()
        )
      )
    ).rejects.toMatchObject({ code: "23514" } satisfies Partial<PgError>);
  });

  it("rejects ends_at <= starts_at", async () => {
    await expect(
      withAnon((client) =>
        callCreateBookingLock(
          client,
          fx.mubarak.a.id,
          "2026-08-20T18:00:00Z",
          "2026-08-20T18:00:00Z",
          freshSessionId()
        )
      )
    ).rejects.toMatchObject({ code: "22023" } satisfies Partial<PgError>);
  });

  it("rejects a blank session_id", async () => {
    await expect(
      withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.a.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", "")
      )
    ).rejects.toMatchObject({ code: "22023" } satisfies Partial<PgError>);
  });

  it("rejects a non-existent field_section_id", async () => {
    await expect(
      withAnon((client) =>
        callCreateBookingLock(
          client,
          "00000000-0000-0000-0000-000000000000",
          "2026-08-20T18:00:00Z",
          "2026-08-20T19:00:00Z",
          freshSessionId()
        )
      )
    ).rejects.toMatchObject({ code: "23503" } satisfies Partial<PgError>);
  });

  it("blocks a second lock on the SAME section/time (exclusion_violation)", async () => {
    const session1 = freshSessionId();
    const session2 = freshSessionId();

    await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", session1)
    );

    await expect(
      withAnon((client) =>
        callCreateBookingLock(
          client,
          fx.mubarak.a.id,
          "2026-08-20T18:30:00Z",
          "2026-08-20T19:30:00Z",
          session2
        )
      )
    ).rejects.toMatchObject({ code: "23P01" } satisfies Partial<PgError>);
  });
});
