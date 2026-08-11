const STORAGE_KEY = "malaab-al-watan:session-id";

/**
 * Returns a stable, per-browser identifier used as the `session_id` for
 * booking_locks, so a customer's own browser can recognize "this is my
 * hold" (e.g. to show a countdown or release it on navigation).
 *
 * This is a UX convenience, NOT a security boundary — it is not tied to
 * any authenticated identity. See docs/BUSINESS_LOGIC.md.
 */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    // SSR/non-browser context: caller should generate a fresh id per
    // request instead of relying on persistence.
    return crypto.randomUUID();
  }

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const created = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, created);
  return created;
}
