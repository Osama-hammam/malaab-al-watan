import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
    // Integration tests share one Postgres instance and mutate shared
    // transactional tables (bookings/booking_locks/etc) — running test
    // FILES in parallel would corrupt each other's fixtures via the
    // per-file beforeEach truncation. Tests within a file still run
    // sequentially by default, which is what the concurrency tests rely
    // on to deliberately fire real parallel queries themselves.
    fileParallelism: false,
  },
});
