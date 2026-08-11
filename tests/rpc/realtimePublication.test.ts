import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pool, closePool } from "./helpers/db";

const MIGRATION_PATH = path.resolve(
  __dirname,
  "../../supabase/migrations/20260812000000_phase5_realtime.sql"
);

async function runMigration() {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  await pool.query(sql);
}

describe("Phase 5 realtime migration", () => {
  afterAll(async () => {
    await pool.query("drop publication if exists supabase_realtime");
    await closePool();
  });

  it("is a safe no-op when supabase_realtime publication does not exist (local Postgres)", async () => {
    await pool.query("drop publication if exists supabase_realtime");
    await expect(runMigration()).resolves.not.toThrow();

    const { rows } = await pool.query(
      "select 1 from pg_publication where pubname = 'supabase_realtime'"
    );
    expect(rows).toHaveLength(0); // still doesn't exist — confirms it wasn't created as a side effect
  });

  it("adds bookings, booking_locks, closed_slots, and payment_receipts when the publication exists", async () => {
    await pool.query("drop publication if exists supabase_realtime");
    await pool.query("create publication supabase_realtime");

    await runMigration();

    const { rows } = await pool.query<{ tablename: string }>(
      "select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename"
    );
    const tables = rows.map((r) => r.tablename);

    expect(tables).toEqual(
      expect.arrayContaining(["bookings", "booking_locks", "closed_slots", "payment_receipts"])
    );
  });

  it("is idempotent — running it twice against an existing publication does not error", async () => {
    await pool.query("drop publication if exists supabase_realtime");
    await pool.query("create publication supabase_realtime");

    await runMigration();
    await expect(runMigration()).resolves.not.toThrow();

    const { rows } = await pool.query(
      "select count(*) from pg_publication_tables where pubname = 'supabase_realtime'"
    );
    expect(rows[0].count).toBe("4"); // no duplicates
  });
});
