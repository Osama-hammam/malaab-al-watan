import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { withAnon, resetTransactionalData, closePool, type PgError } from "./helpers/db";
import { loadFixtures, freshSessionId, type SeededFixtures } from "./helpers/testData";
import { callCreateBookingLock, callReleaseBookingLock } from "./helpers/rpc";

const SLOT = { start: "2026-08-20T18:00:00Z", end: "2026-08-20T19:00:00Z" };

describe("A/B/AB conflict rules", () => {
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

  it("A blocks a subsequent A on the same slot", async () => {
    await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, SLOT.start, SLOT.end, freshSessionId())
    );
    await expect(
      withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.a.id, SLOT.start, SLOT.end, freshSessionId())
      )
    ).rejects.toMatchObject({ code: "23P01" } satisfies Partial<PgError>);
  });

  it("A blocks AB on the same slot", async () => {
    await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, SLOT.start, SLOT.end, freshSessionId())
    );
    await expect(
      withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.ab.id, SLOT.start, SLOT.end, freshSessionId())
      )
    ).rejects.toMatchObject({ code: "23P01" } satisfies Partial<PgError>);
  });

  it("B blocks a subsequent B on the same slot", async () => {
    await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.b.id, SLOT.start, SLOT.end, freshSessionId())
    );
    await expect(
      withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.b.id, SLOT.start, SLOT.end, freshSessionId())
      )
    ).rejects.toMatchObject({ code: "23P01" } satisfies Partial<PgError>);
  });

  it("B blocks AB on the same slot", async () => {
    await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.b.id, SLOT.start, SLOT.end, freshSessionId())
    );
    await expect(
      withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.ab.id, SLOT.start, SLOT.end, freshSessionId())
      )
    ).rejects.toMatchObject({ code: "23P01" } satisfies Partial<PgError>);
  });

  it("AB blocks A on the same slot", async () => {
    await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.ab.id, SLOT.start, SLOT.end, freshSessionId())
    );
    await expect(
      withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.a.id, SLOT.start, SLOT.end, freshSessionId())
      )
    ).rejects.toMatchObject({ code: "23P01" } satisfies Partial<PgError>);
  });

  it("AB blocks B on the same slot", async () => {
    await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.ab.id, SLOT.start, SLOT.end, freshSessionId())
    );
    await expect(
      withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.b.id, SLOT.start, SLOT.end, freshSessionId())
      )
    ).rejects.toMatchObject({ code: "23P01" } satisfies Partial<PgError>);
  });

  it("AB blocks a subsequent AB on the same slot", async () => {
    await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.ab.id, SLOT.start, SLOT.end, freshSessionId())
    );
    await expect(
      withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.ab.id, SLOT.start, SLOT.end, freshSessionId())
      )
    ).rejects.toMatchObject({ code: "23P01" } satisfies Partial<PgError>);
  });

  it("A and B together on the same slot BOTH succeed (independent halves)", async () => {
    const lockA = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, SLOT.start, SLOT.end, freshSessionId())
    );
    const lockB = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.b.id, SLOT.start, SLOT.end, freshSessionId())
    );
    expect(lockA.lock_id).toBeTruthy();
    expect(lockB.lock_id).toBeTruthy();
  });

  it("A and B together on the same slot prevent AB", async () => {
    const sessionA = freshSessionId();
    const sessionB = freshSessionId();
    await withAnon((client) => callCreateBookingLock(client, fx.mubarak.a.id, SLOT.start, SLOT.end, sessionA));
    await withAnon((client) => callCreateBookingLock(client, fx.mubarak.b.id, SLOT.start, SLOT.end, sessionB));

    await expect(
      withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.ab.id, SLOT.start, SLOT.end, freshSessionId())
      )
    ).rejects.toMatchObject({ code: "23P01" } satisfies Partial<PgError>);
  });

  it("releasing A while B is still held still leaves AB blocked (by B)", async () => {
    const sessionA = freshSessionId();
    const sessionB = freshSessionId();
    const lockA = await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.a.id, SLOT.start, SLOT.end, sessionA)
    );
    await withAnon((client) => callCreateBookingLock(client, fx.mubarak.b.id, SLOT.start, SLOT.end, sessionB));
    await withAnon((client) => callReleaseBookingLock(client, lockA.lock_id, sessionA));

    await expect(
      withAnon((client) =>
        callCreateBookingLock(client, fx.mubarak.ab.id, SLOT.start, SLOT.end, freshSessionId())
      )
    ).rejects.toMatchObject({ code: "23P01" } satisfies Partial<PgError>);
  });

  it("branches are fully independent — the same slot is free on a different branch", async () => {
    await withAnon((client) =>
      callCreateBookingLock(client, fx.mubarak.ab.id, SLOT.start, SLOT.end, freshSessionId())
    );

    const oulaLock = await withAnon((client) =>
      callCreateBookingLock(client, fx.oula.ab.id, SLOT.start, SLOT.end, freshSessionId())
    );
    expect(oulaLock.lock_id).toBeTruthy();
  });
});
