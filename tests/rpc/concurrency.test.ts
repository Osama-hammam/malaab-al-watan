import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { withAnon, pool, resetTransactionalData, closePool } from "./helpers/db";
import { loadFixtures, freshSessionId, type SeededFixtures } from "./helpers/testData";
import { callCreateBookingLock, callConfirmBooking } from "./helpers/rpc";

/** Settles a promise without throwing, so Promise.all doesn't short-circuit on the first rejection — we need to inspect BOTH outcomes. */
async function settle<T>(p: Promise<T>): Promise<{ status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown }> {
  try {
    return { status: "fulfilled", value: await p };
  } catch (reason) {
    return { status: "rejected", reason };
  }
}

describe("concurrency", () => {
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

  it("two users racing for the exact same slot: exactly one succeeds", async () => {
    const slot = { start: "2026-09-05T18:00:00Z", end: "2026-09-05T19:00:00Z" };

    const [r1, r2] = await Promise.all([
      settle(withAnon((client) => callCreateBookingLock(client, fx.oula.ab.id, slot.start, slot.end, "racer-1"))),
      settle(withAnon((client) => callCreateBookingLock(client, fx.oula.ab.id, slot.start, slot.end, "racer-2"))),
    ]);

    const outcomes = [r1, r2];
    const succeeded = outcomes.filter((r) => r.status === "fulfilled");
    const failed = outcomes.filter((r) => r.status === "rejected");

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);

    const { rows } = await pool.query(
      "select session_id from booking_locks where field_section_id = $1 and starts_at = $2",
      [fx.oula.ab.id, slot.start]
    );
    expect(rows).toHaveLength(1);
  });

  it("5 users confirming bookings truly in parallel all get distinct, sequential references", async () => {
    // Non-conflicting slots (different days) so business rules don't
    // reject any of them — this test is purely about race-safety of the
    // reference counter and overall transactional integrity, not conflict
    // logic (covered elsewhere).
    const sessions = [1, 2, 3, 4, 5].map(() => freshSessionId());
    const locks = await Promise.all(
      sessions.map((sessionId, i) =>
        withAnon((client) =>
          callCreateBookingLock(
            client,
            fx.oula.b.id,
            `2026-10-0${i + 1}T18:00:00Z`,
            `2026-10-0${i + 1}T19:00:00Z`,
            sessionId
          )
        )
      )
    );

    const results = await Promise.all(
      locks.map((lock, i) =>
        withAnon((client) =>
          callConfirmBooking(client, lock.lock_id, sessions[i], `Racer ${i + 1}`, `+20100000000${i + 1}`)
        )
      )
    );

    const references = results.map((r) => r.booking_reference);
    expect(new Set(references).size).toBe(5); // all distinct

    const sequences = references.map((ref) => parseInt(ref.split("-")[2], 10)).sort((a, b) => a - b);
    for (let i = 1; i < sequences.length; i++) {
      expect(sequences[i]).toBe(sequences[i - 1] + 1); // strictly sequential, no gaps or dupes
    }

    const { rows } = await pool.query(
      "select booking_reference, count(*) from bookings group by booking_reference having count(*) > 1"
    );
    expect(rows).toHaveLength(0);
  });

  it("a branch-scoped race does not block an unrelated branch", async () => {
    const slot = { start: "2026-09-06T18:00:00Z", end: "2026-09-06T19:00:00Z" };

    const [mubarakResult, oulaResult] = await Promise.all([
      settle(
        withAnon((client) => callCreateBookingLock(client, fx.mubarak.ab.id, slot.start, slot.end, "branch-race-1"))
      ),
      settle(
        withAnon((client) => callCreateBookingLock(client, fx.oula.ab.id, slot.start, slot.end, "branch-race-2"))
      ),
    ]);

    expect(mubarakResult.status).toBe("fulfilled");
    expect(oulaResult.status).toBe("fulfilled");
  });
});
