import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { withAnon, resetTransactionalData, closePool, type PgError } from "./helpers/db";
import { loadFixtures, freshSessionId, type SeededFixtures } from "./helpers/testData";
import { callCreateBookingLock, callReleaseBookingLock } from "./helpers/rpc";

describe("release_booking_lock", () => {
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

  it("releases a lock when session_id matches", async () => {
    const sessionId = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", sessionId)
    );

    const result = await withAnon((client) => callReleaseBookingLock(client, lock.lock_id, sessionId));
    expect(result.released).toBe(true);
    expect(result.lock_id).toBe(lock.lock_id);
  });

  it("refuses to release a lock belonging to a DIFFERENT session", async () => {
    const ownerSession = freshSessionId();
    const attackerSession = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(
        client,
        fx.mubarak.a.id,
        "2026-08-20T18:00:00Z",
        "2026-08-20T19:00:00Z",
        ownerSession
      )
    );

    await expect(
      withAnon((client) => callReleaseBookingLock(client, lock.lock_id, attackerSession))
    ).rejects.toMatchObject({ code: "P0002" } satisfies Partial<PgError>);

    // and the lock must still exist, provably unaffected by the attempt —
    // the rightful owner can still release it afterward.
    const result = await withAnon((client) => callReleaseBookingLock(client, lock.lock_id, ownerSession));
    expect(result.released).toBe(true);
  });

  it("errors on releasing an already-released lock", async () => {
    const sessionId = freshSessionId();
    const lock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", sessionId)
    );
    await withAnon((client) => callReleaseBookingLock(client, lock.lock_id, sessionId));

    await expect(
      withAnon((client) => callReleaseBookingLock(client, lock.lock_id, sessionId))
    ).rejects.toMatchObject({ code: "P0002" } satisfies Partial<PgError>);
  });

  it("freeing a lock allows a previously-blocked conflicting lock to succeed", async () => {
    const sessionA = freshSessionId();
    const sessionAB = freshSessionId();

    const lockA = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", sessionA)
    );

    await expect(
      withAnon((client) =>
        callCreateBookingLock(
          client,
          fx.mubarak.ab.id,
          "2026-08-20T18:00:00Z",
          "2026-08-20T19:00:00Z",
          sessionAB
        )
      )
    ).rejects.toMatchObject({ code: "23P01" } satisfies Partial<PgError>);

    await withAnon((client) => callReleaseBookingLock(client, lockA.lock_id, sessionA));

    const abLock = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.ab.id, "2026-08-20T18:00:00Z", "2026-08-20T19:00:00Z", sessionAB)
    );
    expect(abLock.lock_id).toBeTruthy();
  });
});
