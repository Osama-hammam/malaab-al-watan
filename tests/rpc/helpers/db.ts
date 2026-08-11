import { Pool, type PoolClient } from "pg";

/**
 * These are INTEGRATION tests: they run real SQL against a real Postgres
 * instance with the Phase 2 + Phase 3 migrations applied, exercising the
 * actual triggers/constraints/RLS/RPCs — not mocks. Point
 * TEST_DATABASE_URL at a disposable database; `npm run test:db:setup`
 * (see package.json) creates one from the migrations + seed file.
 *
 * NEVER point this at a production database. Tests truncate transactional
 * tables between runs.
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/malaab_test";

export const pool = new Pool({ connectionString: TEST_DATABASE_URL });

/** A raw Postgres error (from `pg`) carries the SQLSTATE on `.code`, matching what PostgREST surfaces to the frontend. */
export interface PgError extends Error {
  code?: string;
}

/**
 * Checks out a dedicated connection and switches it to the `anon` role
 * (mirroring an unauthenticated Supabase client). Callers MUST release()
 * it when done — use `withAnon` below instead where possible.
 */
export async function getAnonClient(): Promise<PoolClient> {
  const client = await pool.connect();
  await client.query("reset role");
  await client.query("set role anon");
  return client;
}

/** Runs `fn` with a dedicated anon-role client, always releasing it afterward. */
export async function withAnon<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getAnonClient();
  try {
    return await fn(client);
  } finally {
    await client.query("reset role");
    client.release();
  }
}

/** Runs `fn` with a dedicated authenticated-role client impersonating `userId` via the same JWT-claim GUC Supabase uses for auth.uid(). */
export async function withAuthenticated<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("reset role");
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    return await fn(client);
  } finally {
    await client.query("select set_config('request.jwt.claim.sub', '', false)").catch(() => {});
    await client.query("reset role");
    client.release();
  }
}

/** Wipes every transactional table between tests, leaving seeded reference data (branches/field_sections/settings/payment_methods) intact. */
export async function resetTransactionalData(): Promise<void> {
  await pool.query(
    `truncate table booking_events, payment_receipts, bookings, booking_locks, booking_reference_counters restart identity cascade`
  );
}

export async function closePool(): Promise<void> {
  await pool.end();
}
